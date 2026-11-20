import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { getToolName, isTextUIPart, isToolUIPart, type DynamicToolUIPart, type ToolUIPart, type UIMessage } from "ai";
import { useZoneAgentChat } from "../../hooks/useZoneAgentChat";
import { describeToolCall } from "../../lib/agentToolLabels";
import { ConfirmDialog } from "../shared/ConfirmDialog";

const SUGGESTIONS = [
  "Which zones have the most 5xx errors this week?",
  "Show the DNS records for one of my zones",
  "What WAF rules are deployed on each group?",
];

type ToolPart = ToolUIPart | DynamicToolUIPart;
type ApprovalHandler = (args: { id: string; approved: boolean }) => void;

function outputError(part: ToolPart): string | null {
  if (part.state === "output-error") return part.errorText;
  if (part.state === "output-available") {
    const out = part.output as { error?: unknown } | null;
    if (out && typeof out === "object" && typeof out.error === "string") return out.error;
  }
  return null;
}

function ToolCallLine({ part, onApproval }: { part: ToolPart; onApproval: ApprovalHandler }) {
  const label = describeToolCall(getToolName(part), part.input);

  if (part.state === "approval-requested") {
    return (
      <div className="my-2 rounded-lg border border-accent/40 bg-accent-dim p-3">
        <p className="text-xs font-display text-text-secondary mb-1">
          Approve this change? It creates a new DNS record on Cloudflare.
        </p>
        <p className="text-sm font-mono text-text-primary break-words">{label}</p>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            className="btn-primary text-white text-xs font-display px-3 py-1.5 rounded-md"
            onClick={() => onApproval({ id: part.approval.id, approved: true })}
          >
            Approve
          </button>
          <button
            type="button"
            className="text-xs font-display px-3 py-1.5 rounded-md border border-border text-text-secondary hover:border-border-hover hover:text-text-primary"
            onClick={() => onApproval({ id: part.approval.id, approved: false })}
          >
            Reject
          </button>
        </div>
      </div>
    );
  }

  const error = outputError(part);
  const running = part.state === "input-streaming" || part.state === "input-available" || part.state === "approval-responded";
  const denied = part.state === "output-denied";

  let marker = "✓";
  let tone = "text-emerald-400";
  if (running) {
    marker = "…";
    tone = "text-text-muted animate-pulse";
  } else if (denied) {
    marker = "✕";
    tone = "text-text-muted";
  } else if (error) {
    marker = "!";
    tone = "text-red-400";
  }

  return (
    <div className="my-1 text-xs font-mono text-text-secondary">
      <span className={`inline-block w-4 ${tone}`}>{marker}</span>
      {label}
      {denied && <span className="text-text-muted"> (rejected)</span>}
      {error && <div className="ml-4 text-red-400 break-words">{error}</div>}
    </div>
  );
}

function MessageBubble({ message, onApproval }: { message: UIMessage; onApproval: ApprovalHandler }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-[10px] px-4 py-2.5 border ${
          isUser ? "bg-accent-dim border-accent/30" : "bg-bg-secondary border-border"
        }`}
      >
        {message.parts.map((part, i) => {
          if (isTextUIPart(part)) {
            return (
              <p key={i} className="text-sm font-display text-text-primary whitespace-pre-wrap leading-relaxed">
                {part.text}
              </p>
            );
          }
          if (isToolUIPart(part)) {
            return <ToolCallLine key={part.toolCallId} part={part} onApproval={onApproval} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

export function ChatView() {
  const { messages, sendMessage, clearHistory, addToolApprovalResponse, status, stop, error } =
    useZoneAgentChat();
  const [input, setInput] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    void sendMessage({ role: "user", parts: [{ type: "text", text: trimmed }] });
    setInput("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="p-6 max-w-[900px] h-[calc(100vh-4rem)] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold font-display text-text-primary">Ask about my zones</h1>
          <p className="text-xs font-display text-text-secondary mt-0.5">
            Llama 3.3 on Workers AI. Answers come from your zones, DNS, WAF rules and analytics. History is saved per user.
          </p>
        </div>
        <button
          type="button"
          disabled={messages.length === 0}
          onClick={() => setConfirmClear(true)}
          className="text-xs font-display px-3 py-1.5 rounded-md border border-border text-text-secondary hover:border-border-hover hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear history
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1" aria-live="polite">
        {messages.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm font-display text-text-secondary mb-4">Try one of these:</p>
            <div className="flex flex-col items-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-sm font-display px-3 py-1.5 rounded-md border border-border text-text-secondary hover:border-accent/40 hover:text-text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} onApproval={addToolApprovalResponse} />
        ))}
        {status === "submitted" && <p className="text-xs font-mono text-text-muted animate-pulse">Thinking…</p>}
        {error && (
          <p className="text-xs font-mono text-red-400 break-words">Chat error: {error.message}</p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Ask about zones, DNS, WAF rules or traffic…"
          aria-label="Message"
          className="flex-1 resize-none rounded-lg bg-bg-secondary border border-border focus:border-accent/50 focus:outline-none px-3 py-2 text-sm font-display text-text-primary placeholder:text-text-muted"
        />
        {busy ? (
          <button
            type="button"
            onClick={() => void stop()}
            className="text-sm font-display px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="btn-primary text-white text-sm font-display px-4 py-2 rounded-lg disabled:opacity-40"
          >
            Send
          </button>
        )}
      </form>

      <ConfirmDialog
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          clearHistory();
          setConfirmClear(false);
        }}
        title="Clear chat history"
        message="This deletes the saved conversation for your user. It cannot be undone."
        confirmLabel="Clear"
      />
    </div>
  );
}
