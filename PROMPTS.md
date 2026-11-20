# Prompt history

## How this was built

This feature was built AI-assisted with [Claude Code](https://claude.com/claude-code). The architecture decisions (Agents SDK on a Durable Object, Workers AI Llama 3.3, tools that wrap the existing services, one agent per Cloudflare Access identity, human-in-the-loop for mutations) were mine; Claude Code wrote the code, tests and docs against those decisions.

Earlier AI planning artifacts for this repo live in `.sisyphus/plans/`. They are kept as-is for reference.

Each entry below is a prompt I gave, verbatim, followed by a one-line note on what it produced.

---

## 1

````markdown
# Prompt: add an AI chat agent to cloudymccloudflare (Cloudflare assignment)

Paste everything below the line into a Claude Code session started in a local clone of `full-chaos/cloudymccloudflare`.

---

I'm submitting this repo for Cloudflare's "AI-powered application on Cloudflare" assignment. A reviewer will check for four parts: an LLM (Workers AI Llama 3.3 is preferred), workflow or coordination (Workers, Workflows or Durable Objects), user input by chat or voice, and memory or state. The repo already has a Hono Worker, D1, a cron trigger and a React SPA. It has no LLM and no chat. Add those as one feature, an **"Ask about my zones" chat agent**, and get the repo ready for a reviewer. Work on a new branch called `feat/ai-zone-agent`, and open a draft PR when you're done. Don't deploy to production or run remote D1 migrations without asking me.

## 0. Record prompts from the start
Create `PROMPTS.md` at the repo root before doing anything else. Paste this prompt in verbatim as entry 1, then append every later prompt I give you in this session, also verbatim and numbered, with a one-line note on what it produced. The assignment requires prompt history, so this file is a deliverable. Don't summarize or tidy my wording. Also add a short "How this was built" section at the top: AI-assisted with Claude Code, and the architecture decisions were mine.

## 1. Read before writing
- Read `CLAUDE.md`, `AGENTS.md`, `src/server/index.ts`, `src/server/types/env.ts`, `src/server/middleware/{auth,cf-access}.ts`, `wrangler.jsonc`, and the services in `src/server/services/`.
- Check current Cloudflare docs before you use any API, because these move fast: the Agents SDK (`agents` package, `AIChatAgent`, `routeAgentRequest`, `agents/react` `useAgentChat`), Workers AI bindings, and `workers-ai-provider` with the AI SDK. Use the Cloudflare docs MCP or skill if you have one. Use the current Llama 3.3 model id from the Workers AI catalog (expected to be `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, but verify it).

## 2. Build the agent (server)
- Add an `AI` binding and a Durable Object binding with a migration for a new `ZoneAgent` class in `wrangler.jsonc`, and update `Bindings` in `env.ts`.
- `ZoneAgent extends AIChatAgent`. It runs on a Durable Object, which covers coordination, and it persists message history in the agent's built-in SQLite state, which covers memory. Keep one agent instance per user. Key it on the Cloudflare Access identity (email or sub from the verified JWT), not on a client-supplied name.
- Use Workers AI Llama 3.3 through `workers-ai-provider`, with streaming. Write a short system prompt: the agent manages this account's Cloudflare zones and answers only from tool results.
- **Tools** should wrap the existing services and not reimplement anything:
  - Read-only, run freely: list zones and groups (`group.service`), get DNS records (`dns.service.getDNSRecords`), get WAF rules and the deployment log (`security.service`), and get zone, group or account analytics (`analytics.service`).
  - Mutating tools (DNS create, update or delete, and WAF deploy): include at most one, for example creating a DNS record, and gate it with the SDK's human-in-the-loop confirmation so nothing changes without a click. If that adds real complexity, ship read-only and say so in the README.
- Mount the agent route in the Worker's `fetch` so it sits **behind the same auth as `/api/*`** (Cloudflare Access JWT in prod, the existing dev bypass locally). Don't open an unauthenticated path. Export the `ZoneAgent` class from the Worker entry.
- Llama 3.3's tool calling can be flaky. If calls fail, keep the tool schemas small and flat, and handle a tool error by returning a readable message instead of throwing.

## 3. Build the chat UI (client)
- Add a "Chat" view or slide-over panel to the existing React app using `useAgentChat` from `agents/react`, styled with the existing Tailwind conventions and shared components. Show streaming tokens, tool calls as compact "Looked up DNS for example.com" lines, the confirmation prompt for any mutating tool, and a "Clear history" button.
- History must survive a page reload. That proves the memory part.

## 4. Tests and checks
- Add vitest tests for the tool wrappers (mock the services) and for routing and auth, so the agent route rejects requests without valid auth.
- `npm run typecheck`, `npm test -- --run` and `npm run build` must pass. Run the app locally with `npm run dev` and try three questions: "Which zones have the most 5xx errors this week?", "Show the DNS records for <a zone>", and "What WAF rules are deployed on <a group>?". Paste short transcripts into the PR description.

## 5. Reviewer-facing cleanup
- **`CURRENT_REPO_REVIEW.md`**: check each "Highest Priority" finding against the current code (PR #16 "Remediate repo review findings" may have fixed some). Fix any small ones that are still open, especially the security API contract mismatch, if it's quick and tested. Then move the file to `docs/reviews/2026-04-23-repo-review.md` with a status line for each finding (fixed, open or won't fix). Do the same for any stale `CODEBASE_REVIEW.md`. Leave `.sisyphus/plans/` alone, but mention them in `PROMPTS.md` as AI planning artifacts.
- **README**: add an "AI agent" section near the top with a table mapping the assignment's four parts to code. LLM is Workers AI Llama 3.3 in the `ZoneAgent` file. Coordination is Workers, Durable Objects and the cron backfill. Input is the chat UI in the Pages assets. Memory is the agent's SQLite plus D1. Add local run steps (any new `.dev.vars` entries; Workers AI needs `wrangler login` even locally) and a short architecture diagram in text or mermaid. Keep the existing README content below it.
- Don't commit secrets. The account ID, Access team domain and AUD already in `wrangler.jsonc` are public identifiers, so leave them.

## 6. Wrap up
Commit in small, logical commits. Push the branch and open a **draft** PR that summarizes the feature, the four-part mapping, the test transcripts and anything still open. Make sure `PROMPTS.md` holds every prompt I gave you, including any I give after this one.
````

**Produced:** branch `feat/ai-zone-agent` with the `ZoneAgent` chat agent (server + UI), tests, reviewer docs, and a draft PR.

## 2

```text
done.
```

**Produced:** used the dev server started in my own terminal (`USE_WRANGLER_LOGIN=1 npm run dev`) to run the three questions live. That run found and fixed doubled stream tokens from Workers AI, a 256-token answer cutoff, string-typed tool arguments from Llama, and a crash on zones with an empty WAF ruleset. Then it added the transcripts to the PR.

## 3

```text
that's fine. But also I am seeing Error: internal error; reference = 5e94t3d4fik1j4u1v6kk751h 

So I assume that's the erro you're speaking about?
```

**Produced:** an investigation of the `internal error` lines in the local dev log. They are not one of the four fixed bugs.

## 4

```text
[Image #2: screenshot of the chat. "Create a TXT record named agent-test on chaosispeace.com with content hello" shows one successful create_dns_record, then a second identical call that failed with "[81058] An identical record already exists".]
```

**Produced:** a guard so a record created earlier in the same request is skipped without a second approval or API call, and a prompt rule to call create_dns_record once per record. It also rounds the cache hit ratio in analytics answers.

## 5

```text
[Image #3: screenshot of the chat. "Delete the TXT record you just created" and "Delete the TXT record named agent-test on chaosispeace.com with content hello" each led to create_dns_record calls; one created an extra record agent-test TXT "@".]

Delete fails though.
```

**Produced:** deleted both test records (agent-test TXT "hello" and TXT "@") on chaosispeace.com through the app's DNS API. The agent now refuses delete, update and WAF-change requests and points to the DNS Records or Security Rules page. The tool description and approval card now say clearly that approving creates a new record.
