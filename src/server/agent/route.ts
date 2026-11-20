import type { Context } from "hono";
import { getAgentByName } from "agents";
import type { AppEnv } from "../types/env";

export const AGENT_BASE_PATH = "/api/agent";

// One ZoneAgent per verified identity. The client never chooses the instance name.
export async function agentInstanceName(identity: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `user-${hex.slice(0, 32)}`;
}

export async function handleAgentRequest(c: Context<AppEnv>): Promise<Response> {
  const identity = c.get("identity");
  if (!identity) {
    return c.json({ success: false, errors: [{ code: 401, message: "Unauthorized" }] }, 401);
  }
  const agent = await getAgentByName(c.env.ZoneAgent, await agentInstanceName(identity));
  return agent.fetch(c.req.raw);
}
