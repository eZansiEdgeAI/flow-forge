# FlowForge Build Plan — Phases 2–5

This is the detailed working plan for the next phases of FlowForge. It breaks each phase into
milestones and tasks, and every milestone includes a **📚 Learn while you build** section that
explains the concepts, patterns and trade-offs involved — so the plan doubles as a learning
companion.

**Where we are:** Phase 0 (Foundations) and Phase 1 (Kernel) are complete. The monorepo builds
(`pnpm build`), tests pass (`pnpm test`), and the CLI can validate, inspect and headlessly run the
`Grade7-Maths.workforce` reference package with the mock model provider. The identity kernel
(ADR-0010) has also landed: `packages/identity` provides OIDC sign-in, claim-to-role mapping and
sessions, and `WorkflowEngine.resume` now requires an authenticated `Principal` with role checks
and per-run participant binding. Phase 2 is fully complete (ADR-0011).

**Phase 2 is complete (see ADR-0011).** The "Vertical Slice UI" phase was replaced by
**Headless completeness & kernel API hardening**: `@flowforge/kernel` is the formal, transport-
agnostic `KernelApi`; `FileStateStore` and `FileAuditSink` persist state across restarts; the CLI
is fully featured with `runs`, `audit`, and `memory` commands; the Electron shell remains buildable
but receives no new screens until Phase 5. **Next up: Phase 3, starting with real agents
(Milestone 3.1) and tool calling (Milestone 3.2).**

**Try the current system:** after `pnpm install && pnpm build`:
- `flowforge validate fixtures/Grade7-Maths.workforce` — validate the reference package
- `flowforge inspect fixtures/Grade7-Maths.workforce` — show agents, skills, workflows
- `flowforge run fixtures/Grade7-Maths.workforce assignment --mock` — interactive run via stdin
- `flowforge run fixtures/Grade7-Maths.workforce assignment --mock --answers answers.json` — non-interactive CI run
- `flowforge runs list` — list persisted runs (from `~/.flowforge`)
- `flowforge audit show` / `audit verify` / `audit export` — audit trail commands
- `flowforge memory list <namespace>` — inspect agent memory
- `pnpm --filter @flowforge/desktop dev` — open the Milestone 2.1 desktop shell (parked)

**Design rules that govern everything below** (see README):

1. Schemas first — nothing consumes a format without a validating schema.
2. Everything behind an interface — `ModelProvider`, `EmbeddingProvider`, `VectorStore`, `StateStore`, `AuditSink` are swappable.
3. No hardcoded agents or tools — all behaviour comes from `.workforce` packages.
4. Audit is runtime-enforced — every agent step (including all tool calls within a step) emits an immutable, hash-chained audit record.
5. Human actions are authenticated and role-checked — every surface that resumes a run must supply a `Principal`; the engine, not the UI, is the authorization authority.
6. Every kernel capability must be exercisable from the CLI before any UI work begins (ADR-0011).
7. Transport is an adapter concern — email, messaging, portal, CLI, and desktop are all adapters over `KernelApi`; the kernel never knows which transport is in use (ADR-0014).

**Key architectural decisions that shaped this plan** (for new contributors):

| Decision | ADR | Summary |
| --- | --- | --- |
| Workforce packages as the unit of behaviour | ADR-0003 | Platform installs empty; all agents/skills/workflows come from packages |
| Everything behind an interface | ADR-0004 | ModelProvider, VectorStore, StateStore, AuditSink are swappable by deployment |
| OIDC identity + RBAC | ADR-0010 | Authentication and role-checking are kernel concerns, never UI concerns |
| Terminal-first, UI deferred to Phase 5 | ADR-0011 | Prove the kernel contract via CLI and two domain packages before any UI investment |
| Tool calling in ModelProvider | ADR-0012 | Agents use the model API's native tool-calling protocol (ReAct loop); no agent frameworks |
| Embedded vector store + three-tier memory | ADR-0013 | LanceDB (no server) replaces Chroma; knowledge tiers: per-agent, shared package, institutional |
| Multi-transport delivery | ADR-0014 | Email/Matrix/portal are adapters over KernelApi; one VPS serves many organisations |

---

## Phase 2 — Headless completeness & kernel API hardening ✅ Complete

All milestones complete. Highlights:
- `@flowforge/kernel` — formal, transport-agnostic `KernelApi` interface + `FlowForgeKernel` reference implementation.
- File-backed persistence: `FileStateStore`, `FileAuditSink`, package registry, run index.
- Full CLI: `validate`, `inspect`, `run` (with `--answers`, `--watch`, `--identity`), `runs list/show`, `audit show/verify/export`, `memory list/delete`.
- Milestone 2.1 Electron shell: loads a package, signs in via dev identity, runs a workflow, shows audit trail. Parked; no new screens until Phase 5.

**Phase 2 exit criteria — all met:**
- `pnpm test` passes; `FlowForgeKernel` tests cover both in-memory and file-backed persistence. ✔
- Full Grade7-Maths assignment workflow runs in CI via `--answers` (no TTY). ✔
- `flowforge runs list` shows runs from a previous invocation; `flowforge audit verify` exits 0. ✔
- `packages/desktop` still builds and its tests pass. ✔

---

## Phase 3 — Real agents, tool calling & knowledge retrieval *(headless — ADR-0011)*

**Goal:** attach real AI models to the CLI; add tool calling so agents can act on knowledge; ship
the three-tier memory model with real semantic search; add personas; prove the multi-agent
revision workflow. All "done when" criteria target the CLI and tests, not the UI.

### Milestone 3.1 — Real agents via Ollama

Connect a real language model to the existing CLI for the first time. This is the smallest step
from "mock responses" to "actual AI behaviour" and is the foundation everything else in this phase
builds on.

| # | Task | Done when |
| --- | --- | --- |
| 3.1.1 | Run the Grade7-Maths assignment workflow end-to-end with `OllamaProvider` (already in `packages/agents`) and `llama3.2` or `qwen2.5` | `flowforge run fixtures/Grade7-Maths.workforce assignment` (no `--mock`) produces real agent responses; audit records show actual model output |
| 3.1.2 | Document model tier requirements: which Ollama models are recommended per tier (`small`/`medium`/`large`); models must be tool-calling capable for Milestone 3.2 | `docs/model-tiers.md` created; `llama3.1` or `qwen2.5` confirmed as tool-calling-capable |
| 3.1.3 | Validate that audit chain remains intact with real model responses (promptVersion hash, model name captured) | `flowforge audit verify` exits 0 after a real-model run |
| 3.1.4 | `--provider ollama` and `--provider openai` flags on `flowforge run` (today the flag is `--mock`; non-mock defaults to Ollama) | Operator can switch provider without editing code |

**📚 Learn while you build — model tiers and prompt quality**

- Connecting a real model immediately reveals the gap between "a mock that returns JSON" and "a
  model that sometimes adds markdown fences, adds prose before the JSON, or truncates output".
  The `tryParseJson` fallback in `AgentRuntime` exists for this reason — but it only goes so far.
  Tool calling (Milestone 3.2) removes this fragility for structured outputs.
- Model **tiers** exist so that a deployment can put a cheap fast model on `small` agents
  (Coach, feedback summaries) and a capable model on `large` agents (Assessment, Curriculum).
  The `ModelRegistry` maps tier → provider; the package never names a model directly.

### Milestone 3.2 — Tool calling (ADR-0012)

Extend `ModelProvider` with `completeWithTools` so agents can invoke structured actions during
a reasoning step. This is the enabling change for real knowledge retrieval.

| # | Task | Done when |
| --- | --- | --- |
| 3.2.1 | Add `ToolDefinition`, `ToolCall`, `ToolResult`, `CompletionWithToolsRequest/Response` types to `packages/agents/src/providers.ts` (ADR-0012 interface) | Types compile; `ModelProvider` interface extended with optional `completeWithTools` |
| 3.2.2 | `OllamaProvider.completeWithTools` — passes `tools` in the Ollama `/api/chat` request, handles `tool_calls` in the response, loops until final text response (ReAct loop) | Unit test with a tool-calling Ollama model (qwen2.5 or llama3.1) produces a tool call + final answer |
| 3.2.3 | `OpenAICompatibleProvider.completeWithTools` — same ReAct loop via OpenAI tool-calling protocol | Unit test against an OpenAI-compatible endpoint (or mock) passes |
| 3.2.4 | `MockModelProvider` stub for `completeWithTools` — returns a scripted tool call then a scripted final response | All existing tests continue to pass; new tool-calling tests are deterministic offline |
| 3.2.5 | `AgentRuntime.step` ReAct loop — when the agent definition declares `tools` and the provider supports `completeWithTools`, the runtime loops: call provider → if tool call, invoke tool function, feed result back → repeat until final answer | Audit record includes all tool calls and their results as evidence entries |
| 3.2.6 | Tool registry at kernel composition time: package declares `tools: string[]` per agent; deployment registers implementations by name | `agent.schema.json` extended; `FlowForgeKernel` accepts a `tools` map at construction |
| 3.2.7 | Add a `search_knowledge` built-in tool that queries the agent's readable namespaces via `MemoryService` | Assessment agent uses `search_knowledge` to find rubric sections; audit shows the query and results |

**📚 Learn while you build — ReAct and tool calling**

- **Tool calling** is the model API's structured way of invoking external functions: the model
  outputs a typed function call (name + JSON arguments) instead of free text; the runtime
  executes the function and returns the result; the model continues reasoning. This is more
  reliable than "put JSON in the output and parse it" because the model is trained to produce
  well-formed tool calls, not free-form JSON.
- The **ReAct pattern** (Reason → Act → Observe → Reason again) is the standard agentic loop.
  In FlowForge, one `AgentRuntime.step()` call may contain multiple reason/act/observe cycles
  before producing the final output — which is why every tool call within a step is captured in
  the audit record. The entire loop is one audited step, not many.
- Rejecting Semantic Kernel / AutoGen / LangChain here is intentional (ADR-0012): those
  frameworks replace your architecture, not extend it. Tool calling is already in the model
  API you're calling; you need ~40 lines, not a framework.

### Milestone 3.3 — Three-tier knowledge & embedded vector store (ADR-0013)

Replace the in-memory lexical store with a real embedded vector database and implement the
three-tier memory model: per-agent, shared package knowledge, institutional.

| # | Task | Done when |
| --- | --- | --- |
| 3.3.1 | `EmbeddingProvider` interface in `@flowforge/memory` + `OllamaEmbeddingProvider` (`nomic-embed-text` or `mxbai-embed-large` via Ollama `/api/embed`) | Interface compiles; Ollama embedding round-trip tested |
| 3.3.2 | `LanceDBVectorStore` adapter implementing `VectorStore` — file-backed, no server, ANN search via real embeddings | `InMemoryVectorStore` and `LanceDBVectorStore` pass the same interface test suite |
| 3.3.3 | Extend `agent.schema.json` with `readNamespaces: string[]` and `writeNamespaces: string[]` — schema-validated list of namespaces beyond the agent's own that it may read/write | `flowforge validate` passes; an agent cannot read a namespace not declared |
| 3.3.4 | Knowledge ingestion step in `FlowForgeKernel.loadPackage`: chunk + embed each file in an agent's SKILL.md `embeddings` list into `packageId/knowledge/skillName` namespace; idempotent (content-hash checked) | After `flowforge run` with a real embedding provider, `flowforge memory list packageId/knowledge/algebra` shows embedded chunks |
| 3.3.5 | `AgentRuntime` queries all `readNamespaces` (not just own namespace) when building context — merged recall results, deduplicated | Assessment agent configured with `readNamespaces: ["Grade7-Maths/knowledge/algebra"]` demonstrably uses curriculum knowledge in responses |
| 3.3.6 | Retention/decay knobs (max items, age-out) configurable per namespace in package config | Old memory ages out per config; enforced by tests |
| 3.3.7 | Namespace isolation tests: agent A cannot recall from agent B's episodic namespace; `readNamespaces` is the only exception path | Isolation is enforced by tests, not convention |
| 3.3.8 | Memory write policy: what gets remembered after a workflow (per-agent, declared in package config) | Memory writes are declarative package config, not code |

**📚 Learn while you build — embeddings, RAG, and three-tier knowledge**

- **Embeddings** map text to points in high-dimensional space where semantic similarity ≈
  geometric closeness. The current `InMemoryVectorStore` fakes this with lexical token-overlap —
  good enough for tests, but broken for real retrieval: "student struggles with inverse
  operations" will not match "learner has difficulty isolating the variable" even though they
  mean the same thing.
- **LanceDB** is embedded (a file, no server). Choosing it over Chroma/FAISS is an operational
  decision: the deployment model is a single VPS, not a microservices cluster. A file-backed
  store fits; a required server process does not (ADR-0013).
- The **three-tier model** separates *what this agent has learned* (episodic, per-agent) from
  *what the curriculum says* (package knowledge, shared, immutable per-version) from *what the
  organisation has learned over time* (institutional, cross-package, growing). Conflating these
  in one namespace produces garbage retrieval.
- **Institutional memory** is the long game: a Reflection agent writes "this year's cohort
  consistently misapplies the distributive property" into an institutional namespace; next year's
  Planner agent reads it and adjusts the curriculum emphasis before a single lesson is taught.
  This is AI-assisted institutional learning, not just AI-assisted individual tutoring.

### Milestone 3.4 — Persona enforcement

| # | Task | Done when |
| --- | --- | --- |
| 3.4.1 | Extend agent runtime to compose system prompts as *capability (skill) + persona overlay*, with the persona layer clearly delimited | Prompt assembly is unit-tested; audit records capture persona id + version |
| 3.4.2 | Persona selection in `flowforge run` via `--persona <id>` flag per agent node | Same Assessment agent runs as "Supportive Mentor" vs "Strict Examiner" with visibly different feedback |
| 3.4.3 | Persona decision-policy hooks: thresholds/settings a persona can adjust (e.g. strictness), schema-validated | Policy values come from `persona.schema.json`-validated data, not code |
| 3.4.4 | A/B run comparison: `flowforge audit show --run <a> --run <b>` diffs two runs' audit trails | CLI output shows personas used and score deltas between runs |

### Milestone 3.5 — Coach & Reflection agents

| # | Task | Done when |
| --- | --- | --- |
| 3.5.1 | Add Coach and Reflection agent definitions, skills and prompts to the Grade7-Maths fixture (platform code unchanged) | `flowforge validate` passes; agents appear in the roster with zero platform changes |
| 3.5.2 | New `revision` workflow: after feedback, Coach proposes practice steps; learner works through them; Reflection agent summarises takeaways | Workflow runs headlessly via `--answers` with zero code changes |
| 3.5.3 | Coach reads the learner episodic namespace to personalise suggestions | Suggestions demonstrably change based on stored memory |
| 3.5.4 | Reflection agent writes distilled summaries (not raw transcripts) to the learner episodic namespace and, where declared, to the institutional namespace | Memory grows with summaries, not noise; institutional namespace accumulates cross-run insights |
| 3.5.5 | Coach declared with `readNamespaces` including `packageId/knowledge/algebra` — demonstrates shared knowledge access | Coach cites specific curriculum material in suggestions |

### Milestone 3.6 — Graph-level workflow validation

| # | Task | Done when |
| --- | --- | --- |
| 3.6.1 | Graph-level checks in `flowforge validate --graph`: reachability from `start`, no dangling `next` references, every branch has a `default` condition | Invalid workflows are caught before `run`; exit code 1 on failure |
| 3.6.2 | Expose graph validation in `KernelApi.validatePackage` result (add `graphErrors` field) | Any consumer (CLI, future UI) gets graph errors alongside schema errors |

### Phase 3 exit criteria

- Real model run (Ollama, `qwen2.5` or `llama3.1`) completes end-to-end; audit chain intact.
- Tool calling: Assessment agent invokes `search_knowledge` during a step; tool call appears in audit.
- LanceDB-backed memory: knowledge chunks embedded at `loadPackage`; semantic recall demonstrably finds relevant rubric sections by meaning, not just keywords.
- Shared namespace: Coach reads `packageId/knowledge/algebra`; responses cite curriculum material.
- Reflection agent writes institutional memory; cross-run knowledge accumulation verified by test.
- Persona switch demonstrably changes agent behaviour, recorded in audit.
- Coach/Reflection revision workflow runs end-to-end via `--answers`.
- `flowforge validate --graph` catches unreachable nodes and dangling edges.

---

## Phase 4 — Ecosystem & transport adapters

**Goal:** make workforce packages a real ecosystem artefact — exportable, signed, proven domain-
agnostic with a second package, runnable on production infrastructure (Dapr), and reachable via
multiple transports (HTTP server, email, Matrix). This phase proves the kernel contract is stable
before any UI investment.

### Milestone 4.1 — Package export & signing

| # | Task | Done when |
| --- | --- | --- |
| 4.1.1 | Canonical archive: `.workforce` as a deterministic zip (stable file order, normalised metadata) with a manifest of file hashes | Building twice from the same source yields identical bytes |
| 4.1.2 | `flowforge pack` / `flowforge unpack` CLI commands | Round-trip preserves package content exactly |
| 4.1.3 | Ed25519 signing: generate keypair, sign manifest, embed signature + public key fingerprint | `flowforge verify` proves integrity + authorship |
| 4.1.4 | Install-time verification: warn on unsigned, refuse on invalid signature | Tampered package is rejected with a clear message |
| 4.1.5 | `engineVersion` compatibility metadata: old engine refuses a too-new package gracefully | Version mismatch produces a clear error, not a crash |

### Milestone 4.2 — Second domain package: Corporate-Onboarding

| # | Task | Done when |
| --- | --- | --- |
| 4.2.1 | Author `fixtures/Corporate-Onboarding.workforce`: HR-Planner, Buddy, Compliance, Manager-Review agents; onboarding workflow with human approvals | Validates and runs headlessly with zero platform changes |
| 4.2.2 | Domain-language audit: hunt for education-specific assumptions in platform code or schemas | Grep-level audit is clean or fixes land in the schema layer |
| 4.2.3 | Run both packages side by side; verify isolated memory and audit | Two packages, two isolated audit chains, zero cross-contamination |
| 4.2.4 | Write `docs/authoring-packages.md` — package author guide including tool declarations, knowledge namespaces, and model tier requirements | A newcomer can scaffold a third package from the guide |
| 4.2.5 | Institutional namespace configuration: deployment-level config for `orgId/institutional` namespaces and which packages may access them | Two packages can share institutional knowledge under explicit policy |

### Milestone 4.3 — HTTP server transport adapter (ADR-0014)

Expose `KernelApi` over HTTP/HTTPS so any client (web portal, mobile app, email gateway, Matrix
bot, external script) can call the kernel without Electron IPC.

| # | Task | Done when |
| --- | --- | --- |
| 4.3.1 | `packages/server` — lightweight HTTP server (e.g. Fastify) exposing `KernelApi` as REST endpoints + WebSocket for event subscription | `flowforge serve` starts an HTTP server; `flowforge run` against it works identically to direct kernel use |
| 4.3.2 | Authentication middleware: every HTTP endpoint validates a ****** against the `IdentityService` before calling the kernel | Unauthenticated requests return 401; authenticated requests produce a real `Principal` |
| 4.3.3 | `KernelApi` event subscription: `subscribeToRun(runId, callback)` (or WebSocket channel) so transports receive push events | Transport adapter receives `run.waitingForHuman` without polling |
| 4.3.4 | Email transport adapter (outbound): configurable SMTP relay sends notifications on workflow events (run started, waiting for human, completed) | Teacher receives an email when a workflow is waiting for approval |
| 4.3.5 | Email transport adapter (inbound structured commands): signed confirmation links in outbound emails; inbound click/reply maps to `resumeRun` with a Principal derived from the authenticated email address | Teacher can approve a workflow step by clicking a link in the notification email |
| 4.3.6 | Matrix bot adapter (stretch): outbound notifications + structured inbound commands | FlowForge bot in a Matrix room sends/receives workflow events |

**📚 Learn while you build — transport adapters & the one-server model**

- The HTTP server is the third `KernelApi` consumer after CLI and Electron. Each new consumer
  tests whether the interface is truly transport-agnostic. If you find yourself adding
  HTTP-specific fields to `KernelApi` types, stop — the interface is leaking.
- Email notifications are **outbound-first**: emit events, don't try to parse freeform replies.
  The signed confirmation link is the "structured inbound" path — it is not parsing email; it
  is parsing a URL that the outbound email placed there. Freeform reply parsing is fragile and
  deferred to later.
- The **one-VPS model** (ADR-0014) makes FlowForge viable for schools and small businesses that
  cannot afford per-site hardware. One server, configurable transports, OIDC for identity —
  this is the deployment story.

### Milestone 4.4 — Dapr Workflows runner

| # | Task | Done when |
| --- | --- | --- |
| 4.4.1 | Extract a `WorkflowRunner` interface from the embedded engine (start, resume, query, deliver-human-task) so the engine becomes one implementation | Embedded engine passes a runner-conformance test suite |
| 4.4.2 | Dapr runner package: translate `workflow.schema.json` nodes to Dapr Workflow activities; human nodes become Dapr external-event waits | Assignment workflow runs on Dapr with the same observable behaviour |
| 4.4.3 | State & audit adapters for the hosted context (Dapr state store; `AuditSink` unchanged in contract) | Hash chain verifies identically on both runners |
| 4.4.4 | Dapr-backed `VectorStore` adapter for institutional memory at scale | Both embedded (LanceDB) and Dapr-backed adapters pass the same `VectorStore` test suite |
| 4.4.5 | Docker Compose dev environment (Dapr sidecar, Redis) + docs | `docker compose up` gives a working hosted stack |
| 4.4.6 | Conformance suite run against both runners in CI | One spec, two runners, same results |

### Phase 4 exit criteria

- `flowforge pack`/`verify` round-trips a signed package; tampered packages are rejected.
- Corporate-Onboarding runs with zero platform changes; authoring guide published.
- Both packages share institutional memory under explicit policy.
- `flowforge serve` starts the HTTP server; email notifications fire on workflow events.
- Assignment workflow passes the conformance suite on both embedded and Dapr runners.
- The `KernelApi` is considered stable: two packages proven, two runners proven, HTTP + email transports proven.

---

## Phase 5 — UI layer(s) *(new — ADR-0011)*

**Goal:** thin UI clients over the frozen `KernelApi`. The kernel contains all business logic;
the UI is a rendering and interaction layer only. Exit criterion: **every user action in the UI
is reproducible via the CLI against the same `KernelApi`.**

### Milestone 5.1 — Electron application (completing Milestone 2.1 from the parked shell)

| # | Task | Done when |
| --- | --- | --- |
| 5.1.1 | Package installation flow: pick a `.workforce` folder, show schema + graph errors inline | Invalid package shows all errors; valid package installs |
| 5.1.2 | Workforce home: branding, agent roster, workflow list — all from `KernelApi.listPackages()` | Swapping the package changes the UI; nothing hardcoded |
| 5.1.3 | Teacher portal: start workflow, live run progress, human-input/approval nodes, failure surfacing | Full Grade7-Maths assignment workflow works end-to-end in the UI |
| 5.1.4 | Learner portal: task inbox filtered by signed-in user's roles; feedback view with audit "why?" links | Role filtering is a convenience; the kernel enforces it |
| 5.1.5 | Audit viewer: chronological records, hash-chain verify button, filter, JSON export | `audit verify` in the UI matches `flowforge audit verify` |
| 5.1.6 | Identity (I.6): OIDC authorization-code + PKCE for the desktop app | UI shows the signed-in user from a real OIDC provider; tokens never cross IPC |
| 5.1.7 | Admin governance UI: role-mapping management, session policy, per-user audit trail | Admin can review who did what, as which role, asserted by which provider |

### Milestone 5.2 — Web portal / PWA (ADR-0014)

A lightweight web portal served by the Phase 4 HTTP adapter. This is the multi-device surface —
works on mobile, tablet, and desktop browser with no app to install.

| # | Task | Done when |
| --- | --- | --- |
| 5.2.1 | `packages/portal` — minimal SPA (or server-rendered) web app that calls the Phase 4 HTTP `KernelApi` adapter | Learner can complete a workflow step from a mobile browser |
| 5.2.2 | Learner-focused views: task inbox, human-input form, feedback view with audit trail | Full learner journey works in a browser |
| 5.2.3 | Teacher-focused views: run dashboard, approval queue, audit viewer | Teacher can approve a mark from a browser |
| 5.2.4 | Progressive Web App manifest + service worker: installable on Android/iOS from the browser | Portal installs as a home-screen app with offline task list |

### Milestone 5.3 — Visual workflow editor

| # | Task | Done when |
| --- | --- | --- |
| 5.3.1 | Read-only workflow diagram (React Flow or similar) — renders any `workflow.schema.json` as a node graph | Assignment workflow renders correctly, branches included |
| 5.3.2 | Live run overlay: highlight current node, completed path, pending human task | Watching a run animates the graph |
| 5.3.3 | Editing: add/remove/connect nodes; property panels per node type | Edits round-trip: load → edit → save produces valid JSON |
| 5.3.4 | Continuous validation via `KernelApi.validatePackage` (schema + graph errors from Phase 3) | Invalid graphs cannot be saved silently |
| 5.3.5 | Dry-run button: execute the edited workflow with the mock provider from inside the editor | Author → test loop without leaving the editor |

**📚 Learn while you build — thin clients & the zero-business-logic rule**

- The exit criterion — *every user action is reproducible via the CLI* — is the test of whether
  the UI is truly thin. If you find yourself adding logic to the renderer that is not in
  `FlowForgeKernel`, it belongs in the kernel, not the UI.
- The web portal and Electron desktop call the same `KernelApi` over different transports (HTTP
  vs Electron IPC). Phase 5's value is in proving this claim with two UI surfaces — not because
  two is magic, but because two transports flush out any remaining API assumptions.

### Phase 5 exit criteria

- Grade7-Maths assignment workflow runs end-to-end in the Electron UI with real OIDC identity.
- Learner completes a workflow step in the web portal from a mobile browser.
- Audit trail in both UIs matches `flowforge audit show` output exactly.
- The visual editor can author a valid workflow that runs via `flowforge run`.
- Zero business logic in any renderer: every action has a corresponding CLI test.

---

## Cross-phase — Identity & Governance (ADR-0010)

**Goal:** authenticated, role-checked human actions across every surface, with any OIDC-compliant
identity provider (Microsoft Entra ID, Google Workspace for Education, Auth0, Keycloak).

Shipped in the kernel (Phase 0/1):

| # | Task | Done when |
| --- | --- | --- |
| I.1 | ADR-0010 settles the identity architecture | ADR accepted and indexed ✔ |
| I.2 | `identity.schema.json` in `packages/core/schemas` | Config validates via `validate('identity', …)` ✔ |
| I.3 | `packages/identity` — full OIDC + mock provider, registry, role mapper, session store, audited auth events | Unit tests cover claim mapping, sessions, login/refresh/denial ✔ |
| I.4 | Engine enforcement — `WorkflowEngine.resume` requires a `Principal`, role-checks, per-run participant binding | Grade7-Maths tests prove role enforcement ✔ |
| I.5 | CLI wiring — dev identity by default; `--identity` for device-flow OIDC | `flowforge run … --identity` completes a device-flow login ✔ |

Follow-up:

| # | Task | Done when | Phase |
| --- | --- | --- | --- |
| I.6 | Desktop app login via authorization-code + PKCE | UI shows the signed-in user; every human step passes the Principal | 5.1.6 |
| I.7 | Persistent `SessionStore` across restarts | Sessions survive restart; revocation works | 4 |
| I.8 | Admin governance UI | Admin can review who did what, as which role | 5.1.7 |

---

## Cross-phase — Transport adapters (ADR-0014)

| # | Task | Done when | Phase |
| --- | --- | --- | --- |
| T.1 | `KernelApi` event subscription / push notification mechanism | Transport adapters receive workflow events without polling | 4.3.3 |
| T.2 | HTTP/HTTPS `packages/server` adapter | `flowforge serve` starts; authenticated REST + WebSocket | 4.3.1–4.3.2 |
| T.3 | Email transport (outbound + inbound structured commands) | Notifications fire; signed link approvals work | 4.3.4–4.3.5 |
| T.4 | Matrix bot adapter | Bot sends/receives workflow events in a Matrix room | 4.3.6 (stretch) |
| T.5 | Web portal / PWA | Learner completes workflow from a mobile browser | 5.2 |
| T.6 | SMS transport (Africa's Talking / Twilio) | Workflow notifications reach a feature phone | Community / 5+ |

---

## Suggested build order & dependencies

```
Phase 3:  3.1 (real model, no dependencies) → 3.2 (tool calling, depends on 3.1) →
          3.3 (knowledge store, depends on 3.2 for search_knowledge tool) →
          3.4 (personas, independent) and 3.5 (Coach/Reflection, depends on 3.3) →
          3.6 (graph validation, independent, can run in parallel with 3.4–3.5)

Phase 4:  4.1 (signing, independent) and 4.2 (second package, independent) in parallel →
          4.3 (HTTP server + email, depends on stable kernel from 4.1–4.2) →
          4.4 (Dapr runner, benefits from hardened schema after 4.2; last in phase)

Phase 5:  after Phase 4 exit criteria are met;
          5.1 (Electron) and 5.2 (web portal) can proceed in parallel within the phase;
          5.3 (visual editor) depends on graph validation from Phase 3 (3.6)
```

**Working agreement for every task:** schema changes land first with validator tests; kernel
changes ship with unit tests; CLI changes ship with a headless end-to-end test (`--answers`);
transport adapter changes ship with an integration test against the HTTP adapter; UI changes
ship with a smoke test; every milestone ends with the reference package(s) still validating
and running end-to-end via the CLI.

