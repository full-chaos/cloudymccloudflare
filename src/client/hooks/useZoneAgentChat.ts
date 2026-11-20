import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";

// The server picks the agent instance from the verified Access identity, so the
// client only names the base path (see src/server/agent/route.ts).
export function useZoneAgentChat() {
  const agent = useAgent({ agent: "ZoneAgent", basePath: "api/agent" });
  return useAgentChat({ agent });
}
