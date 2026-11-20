import { describe, it, expect, vi } from "vitest";
import { dedupeStream, dedupeStreamEvent, withStreamDedupe } from "@server/agent/ai-binding";

function event(extra: Record<string, unknown>) {
  return JSON.stringify({ id: "c1", ...extra });
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

function streamOf(...parts: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const p of parts) c.enqueue(enc.encode(p));
      c.close();
    },
  });
}

describe("dedupeStreamEvent", () => {
  it("drops the native text copy when choices carry the same delta", () => {
    const out = JSON.parse(dedupeStreamEvent(event({ response: "The", choices: [{ delta: { content: "The" } }] })));
    expect(out.response).toBeUndefined();
    expect(out.choices[0].delta.content).toBe("The");
  });

  it("drops numeric native responses too (Workers AI sends 605 as a number)", () => {
    const out = JSON.parse(dedupeStreamEvent(event({ response: 605, choices: [{ delta: { content: "605" } }] })));
    expect(out.response).toBeUndefined();
  });

  it("drops the native tool_calls copy when choices carry tool_calls", () => {
    const tc = [{ index: 0, function: { arguments: "{\"a\"" } }];
    const out = JSON.parse(dedupeStreamEvent(event({ tool_calls: tc, choices: [{ delta: { tool_calls: tc } }] })));
    expect(out.tool_calls).toBeUndefined();
    expect(out.choices[0].delta.tool_calls).toEqual(tc);
  });

  it("keeps native fields when choices have no matching delta", () => {
    const raw = event({ response: "", tool_calls: [], choices: [{ delta: {} }] });
    expect(dedupeStreamEvent(raw)).toBe(raw);
    const nativeOnly = event({ response: "hi" });
    expect(dedupeStreamEvent(nativeOnly)).toBe(nativeOnly);
  });

  it("passes non-JSON data through", () => {
    expect(dedupeStreamEvent("[DONE]")).toBe("[DONE]");
  });
});

describe("dedupeStream", () => {
  it("rewrites SSE lines split across chunks", async () => {
    const line = `data: ${event({ response: "Hi", choices: [{ delta: { content: "Hi" } }] })}\n\n`;
    const out = await readAll(dedupeStream(streamOf(line.slice(0, 20), line.slice(20), "data: [DONE]\n\n")));
    expect(out).not.toContain('"response"');
    expect(out).toContain('"content":"Hi"');
    expect(out).toContain("data: [DONE]");
  });
});

describe("withStreamDedupe", () => {
  it("wraps streamed run results and passes other results through", async () => {
    const line = `data: ${event({ response: "x", choices: [{ delta: { content: "x" } }] })}\n\n`;
    const run = vi.fn().mockResolvedValueOnce(streamOf(line)).mockResolvedValueOnce({ response: "plain" });
    const ai = withStreamDedupe({ run } as unknown as Ai);

    const streamed = (await ai.run("@cf/model" as never, {} as never)) as unknown as ReadableStream<Uint8Array>;
    expect(await readAll(streamed)).not.toContain('"response"');
    expect(await ai.run("@cf/model" as never, {} as never)).toEqual({ response: "plain" });
  });
});
