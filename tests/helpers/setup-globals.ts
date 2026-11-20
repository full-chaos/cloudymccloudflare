// Node 20 (CI) has no global WebSocket; the Agents SDK references it at import time.
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class {} as unknown as typeof WebSocket;
}
