import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import { createWorkersAI } from "workers-ai-provider";
import { convertToModelMessages, isStepCount, pruneMessages, streamText } from "ai";
import type { Bindings } from "../types/env";
import { createdRecordKeysSinceLastUserMessage, createToolDeps, createZoneTools } from "./tools";
import { withStreamDedupe } from "./ai-binding";

export const ZONE_AGENT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Llama 3.3 has a 24k-token window; older turns stay in SQLite but are not sent to the model.
const MAX_CONTEXT_MESSAGES = 20;

export const SYSTEM_PROMPT = `You are the zone assistant for one Cloudflare account. You help the user understand and manage its zones, DNS records, zone groups, WAF rules and traffic analytics.

Rules:
- Answer only from tool results. If no tool gives the answer, say you do not know.
- Call a tool before you answer any question about zones, DNS, groups, WAF rules or traffic.
- Use exact zone and group names from list_zones or list_groups.
- "This week" means range "7d". "Today" means range "24h".
- If a tool returns an error, tell the user what failed in one sentence.
- The only change you can make is creating a new DNS record with create_dns_record. The user must approve it. Never claim a change was made unless the tool result confirms it.
- You cannot delete, update or rename DNS records, and you cannot change WAF rules. If the user asks for that, say so in one sentence and tell them to use the DNS Records or Security Rules page. Never call create_dns_record for those requests.
- Call create_dns_record at most once per record. When it returns "created", tell the user the record was created and stop.
- Keep answers short and in plain text. For many items, write one line per item starting with "- ". Do not use Markdown tables, headings or bold.`;

export class ZoneAgent extends AIChatAgent<Bindings> {
  // Instance names are derived from the user's identity; do not echo them to the browser.
  static options = { sendIdentityOnConnect: false };

  maxPersistedMessages = 200;

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions): Promise<Response> {
    const workersai = createWorkersAI({ binding: withStreamDedupe(this.env.AI) });
    const tools = createZoneTools(
      createToolDeps(this.env),
      createdRecordKeysSinceLastUserMessage(this.messages),
    );

    const recent = this.messages.slice(-MAX_CONTEXT_MESSAGES);
    const result = streamText({
      model: workersai(ZONE_AGENT_MODEL),
      system: SYSTEM_PROMPT,
      messages: pruneMessages({
        messages: await convertToModelMessages(recent),
        toolCalls: "before-last-2-messages",
      }),
      tools,
      // Workers AI defaults to 256 output tokens, which truncates DNS listings.
      maxOutputTokens: 1024,
      stopWhen: isStepCount(6),
      abortSignal: options?.abortSignal,
    });

    return result.toUIMessageStreamResponse({
      onError: (err) => `The model call failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}
