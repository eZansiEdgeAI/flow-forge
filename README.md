# FlowForge

**An Agent Workforce Platform.** FlowForge separates the *platform* from the *knowledge and process*: the application knows nothing until a **Workforce Package** is installed. Install `Grade7-Maths.workforce` and a classroom workforce appears — Planner, Curriculum, Assessment, Feedback and Teacher agents, their skills, personas, workflows and rubrics. Install `Corporate-Onboarding.workforce` and the same software becomes a different workforce. Education is the flagship use case, not the limit.

> "FlowForge is an open engineering experiment exploring what an Agent Learning Operating System could look like: where workflows, people, AI agents, skills and knowledge evolve together through continuous learning."

## Core concepts

| Concept | What it is |
| --- | --- |
| **Workforce Package** | The unit of distribution (`.workforce`): agents, skills, personas, workflows, rubrics, knowledge, permissions, branding. Versioned, validatable, shareable. |
| **Agent** | A digital specialist with a role, skills, tools, model-tier requirement, its own memory namespace and enforced permissions. |
| **Skill** | A plug-in folder of domain knowledge with a single `SKILL.md` ([Agent Skills](https://agentskills.io) format: YAML frontmatter manifest + Markdown instructions) plus prompts and tools. Swapping the curriculum swaps skills — no code changes. |
| **Persona** | Interaction style and decision policy layered *on top of* capability. The same Assessment Agent can be a Supportive Mentor or a Strict Examiner. |
| **Workflow** | A declarative spec (agent steps, human-input, human-approval, retry, branch). Human-in-the-loop is a first-class node type. Portable across runners. |
| **State vs Memory** | State is transactional workflow data (engine-owned). Memory is accumulated knowledge, owned per agent in its own namespace — replacing one agent never loses another's memory. |
| **Audit** | Every agent step and human override emits an immutable, hash-chained audit record: prompt version, model, evidence, rubric section, score, confidence, overrides. Every mark is explainable. |

## Repository layout

```
packages/
  core/                @flowforge/core      — domain types + the six JSON Schemas + validator
  workforce-packages/  @flowforge/packages  — .workforce package loader & cross-reference validation
  agents/              @flowforge/agents    — agent runtime + model provider abstraction (mock / Ollama / OpenAI-compatible)
  memory/              @flowforge/memory    — per-agent memory service (swappable vector store)
  audit/               @flowforge/audit     — append-only, hash-chained audit log
  workflow/            @flowforge/workflow  — embedded workflow engine (pause/resume, retries, branching)
  identity/            @flowforge/identity  — OIDC identity, claim-to-role mapping, sessions (ADR-0010)
  kernel/              @flowforge/kernel    — transport-agnostic KernelApi + reference implementation
  cli/                 @flowforge/cli       — flowforge validate | inspect | run | runs | audit | memory
  desktop/             @flowforge/desktop   — Electron + React desktop shell (buildable; parked until Phase 5)
fixtures/
  Grade7-Maths.workforce/                   — reference workforce package
skills/
  meeting-minutes/                          — reusable, cross-project Agent Skill for turning discussions into minutes
```

## Getting started

```bash
pnpm install
pnpm lint
pnpm build
pnpm test

# validate & explore the reference package
node packages/cli/dist/index.js validate fixtures/Grade7-Maths.workforce
node packages/cli/dist/index.js inspect fixtures/Grade7-Maths.workforce

# run the assignment workflow headlessly (mock model, interactive human steps)
node packages/cli/dist/index.js run fixtures/Grade7-Maths.workforce assignment --mock

# run a non-interactive workflow, inspect persisted runs, audit, and memory
node packages/cli/dist/index.js run fixtures/Grade7-Maths.workforce assignment --mock --answers answers.json
node packages/cli/dist/index.js runs list
node packages/cli/dist/index.js audit verify
node packages/cli/dist/index.js memory list teacher

# try the desktop shell (Milestone 2.1, currently parked): load the reference package,
# sign in as a role (dev identity), run the assignment workflow, inspect the audit trail
pnpm --filter @flowforge/desktop dev
```

## Design rules

1. **Schemas first** — nothing consumes a format without a validating schema (`packages/core/schemas/`).
2. **Everything behind an interface** — `ModelProvider`, `EmbeddingProvider`, `VectorStore`, `StateStore`, `AuditSink` are swappable (local/offline vs cloud).
3. **No hardcoded agents or tools** — all behaviour comes from packages; the platform installs empty.
4. **Audit is runtime-enforced** — an agent step cannot run without emitting an audit record.
5. **All human actions are authenticated and role-checked** — workflow input and approvals require an OIDC-verified `Principal` whose deployment-mapped roles match the node's declared role ([ADR-0010](docs/adr/0010-oidc-identity-and-role-based-authorization.md)).
6. **Every kernel capability must be exercisable from the CLI before UI work** ([ADR-0011](docs/adr/0011-terminal-first-ui-deferred.md)).
7. **Transport is an adapter concern** — email, messaging, portal, CLI, and desktop are all adapters over `KernelApi` ([ADR-0014](docs/adr/0014-multi-transport-delivery.md)).

The reasoning behind these and other foundational decisions is captured as Architecture Decision
Records in [docs/adr/](docs/adr/README.md).

## Roadmap

The detailed, task-level plan for the next phases — including "learn while you build" notes on the
concepts behind each milestone — lives in [docs/PLAN.md](docs/PLAN.md).

For a concise "why this project exists and how we think about it" introduction, see
[docs/team-intro.md](docs/team-intro.md).

For a detailed view of the current Phase 1/kernel branch — including what you can run today and what
it proves before the UI phase — see [docs/phase-1-kernel-architecture.md](docs/phase-1-kernel-architecture.md).

For the desktop shell pages architecture, planned Phase 5 screens, and a full explanation of how
LLMs are integrated — see [docs/pages-architecture.md](docs/pages-architecture.md).

For reusable, cross-project Agent Skills authored in the same format FlowForge uses internally, see
[skills/README.md](skills/README.md).

- **Phase 0 — Foundations** ✅ monorepo, six core schemas, CLI validator, reference package
- **Phase 1 — Kernel** ✅ package loader, agent runtime, memory service, workflow engine, audit log, end-to-end headless test
- **Phase 2 — Headless completeness & kernel API hardening** ✅ complete — `KernelApi`, file-backed persistence, full CLI, Electron shell parked until Phase 5
- **Phase 3 — Real agents, tool calling & knowledge retrieval** 🚧 in progress — Ollama/OpenAI providers, tool calling, three-tier semantic memory, personas
- **Phase 4 — Ecosystem** — package export/signing, second domain package, Dapr Workflows runner
- **Phase 5 — UI** — desktop and portal experiences on top of the proven kernel contract
