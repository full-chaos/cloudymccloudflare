import type { ZoneAgent } from "../agent/zone-agent";

export type Bindings = {
  DB: D1Database;
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  APP_SECRET: string;
  ENVIRONMENT: string;
  ENABLE_DEV_AUTH_BYPASS?: string;
  TEAM_DOMAIN: string;
  POLICY_AUD: string;
  AI: Ai;
  ZoneAgent: DurableObjectNamespace<ZoneAgent>;
};

export type AppVariables = {
  /** Verified caller identity set by authMiddleware (Access email/sub, or a fixed label for service/dev auth). */
  identity: string;
};

export type AppEnv = { Bindings: Bindings; Variables: AppVariables };
