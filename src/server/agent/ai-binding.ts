// Workers AI streams Llama 3.3 output twice per SSE event: in the native `response` /
// `tool_calls` fields and in the OpenAI-style `choices[0].delta`. workers-ai-provider reads
// both, which doubles every text and tool-argument delta (and breaks tool JSON). Keep the
// OpenAI-style copy only.

type SSEChunk = {
  response?: unknown;
  tool_calls?: unknown;
  choices?: Array<{ delta?: { content?: unknown; tool_calls?: unknown } }>;
};

export function dedupeStreamEvent(data: string): string {
  if (!data.includes("choices")) return data;
  let chunk: SSEChunk;
  try {
    chunk = JSON.parse(data) as SSEChunk;
  } catch {
    return data;
  }
  const delta = chunk.choices?.[0]?.delta;
  if (!delta) return data;
  let changed = false;
  // `response` is sometimes a JSON number for numeric tokens (e.g. 605), so don't check its type.
  if (chunk.response !== undefined && typeof delta.content === "string" && delta.content.length > 0) {
    delete chunk.response;
    changed = true;
  }
  if (Array.isArray(chunk.tool_calls) && Array.isArray(delta.tool_calls)) {
    delete chunk.tool_calls;
    changed = true;
  }
  return changed ? JSON.stringify(chunk) : data;
}

export function dedupeStream(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const fixLine = (line: string) =>
    line.startsWith("data: ") ? `data: ${dedupeStreamEvent(line.slice(6))}` : line;

  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(bytes, controller) {
        buffer += decoder.decode(bytes, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        if (lines.length > 0) controller.enqueue(encoder.encode(lines.map(fixLine).join("\n") + "\n"));
      },
      flush(controller) {
        buffer += decoder.decode();
        if (buffer) controller.enqueue(encoder.encode(fixLine(buffer)));
      },
    }),
  );
}

export function withStreamDedupe(ai: Ai): Ai {
  return new Proxy(ai, {
    get(target, prop) {
      if (prop === "run") {
        return async (...args: Parameters<Ai["run"]>) => {
          const result: unknown = await target.run(...args);
          return result instanceof ReadableStream ? dedupeStream(result) : result;
        };
      }
      const value: unknown = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
