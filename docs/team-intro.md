# FlowForge — Team Introduction

> This document captures the conversation, thinking and decisions behind FlowForge. It works like
> meeting minutes: a record of what was discussed, why decisions were made, and what the project
> is really trying to do — so any new contributor can get up to speed quickly.

---

## Who is on the team?

FlowForge is being built as an open engineering experiment, led by **@McFuzzySquirrel** with
**GitHub Copilot** as a collaborative pair-programming and architecture partner. Every design
conversation, architectural decision and trade-off discussion has been worked through together
and captured either here, in the ADRs (`docs/adr/`), or in the build plan (`docs/PLAN.md`).

That means the ADRs are not just documentation — they are meeting minutes. They record *why*
each decision was made at the time it was made, not a post-hoc rationalisation.

---

## What is FlowForge, really?

FlowForge is an **Agent Workforce Platform**. But the best way to understand it is through the
problem it solves:

> Most AI agent frameworks bake the domain knowledge into the application code. FlowForge
> separates the *platform* from the *knowledge and process* entirely. The platform installs
> empty. All agents, skills, workflows, personas, rubrics and knowledge arrive in a
> **Workforce Package** (`.workforce`). Swap the package and you have a completely different
> workforce — same software, zero code changes.

The flagship domain is **education** (the `Grade7-Maths.workforce` reference package), but
the architecture deliberately imposes no limit. The same platform could run a corporate
onboarding workforce, a legal review workforce, or a medical triage workforce.

The project's own mission statement:

> *"FlowForge is an open engineering experiment exploring what an Agent Learning Operating
> System could look like: where workflows, people, AI agents, skills and knowledge evolve
> together through continuous learning."*

---

## Key decisions we made (and why)

These are the most important forks in the road, summarised in plain language. Full reasoning
lives in the linked ADR.

### 1. Workforce packages as the unit of everything ([ADR-0003](adr/0003-workforce-packages.md))

**Decision:** all domain behaviour — agents, skills, workflows, rubrics, personas, knowledge,
permissions, branding — ships in a single versioned, validatable `.workforce` package.

**Why:** it makes the platform genuinely domain-agnostic and creates a clean, auditable boundary
between what the platform does and what each deployment does. It also makes the system testable
in isolation: the reference package can be validated, inspected and run headlessly in CI without
a real model.

### 2. Schemas first ([ADR-0002](adr/0002-schemas-first.md))

**Decision:** nothing in the system consumes a format without a validating JSON Schema.
Schemas live in `packages/core/schemas/`.

**Why:** in a system where packages come from outside and contain executable behaviour, an
unchecked format is a security and reliability risk. Schemas make the contract explicit and
machine-enforced.

### 3. Everything behind an interface ([ADR-0004](adr/0004-everything-behind-an-interface.md))

**Decision:** `ModelProvider`, `VectorStore`, `StateStore`, `AuditSink` and
`EmbeddingProvider` are all defined as interfaces. No concrete implementation is imported
directly — only the interface.

**Why:** this is what makes the system runnable offline (mock provider), in development
(Ollama), and in production (OpenAI-compatible) without changing any business logic. Swap an
adapter, not the kernel.

### 4. Runtime-enforced, hash-chained audit ([ADR-0006](adr/0006-runtime-enforced-hash-chained-audit.md))

**Decision:** every agent step emits an immutable, hash-chained audit record. The workflow
engine refuses to run a step without one.

**Why:** in high-stakes domains (marking a student's work, making a hiring decision) you need
to be able to prove *exactly* what happened: which model, which prompt version, which rubric
section, what score, what confidence, and whether a human overrode it. Audit cannot be opt-in.

### 5. OIDC identity and RBAC in the kernel ([ADR-0010](adr/0010-oidc-identity-and-role-based-authorization.md))

**Decision:** authentication and role-checking are kernel concerns, not UI concerns.
`WorkflowEngine.resume` requires a verified `Principal`. The UI only passes credentials through.

**Why:** if the UI enforces access control, a different UI (CLI, API, direct call) bypasses it.
The kernel is the only choke point that every transport must go through.

### 6. Terminal-first, UI deferred to Phase 5 ([ADR-0011](adr/0011-terminal-first-ui-deferred.md))

**Decision:** every kernel capability must be demonstrable from the CLI before any UI work.
The Electron shell is parked after Milestone 2.1.

**Why:** building a UI on top of an unproven kernel is a trap. The CLI forces the kernel's API
to be clean and complete — if you cannot drive it from the CLI, the API is not done. Phase 5
UI work will be straightforward because the kernel contract is already solid.

### 7. Multi-transport delivery ([ADR-0014](adr/0014-multi-transport-delivery.md))

**Decision:** email, messaging (Matrix), web portal and desktop are all adapters over a
single `KernelApi`. The kernel never knows which transport is in use.

**Why:** schools and small organisations cannot always mandate a specific portal. Being able to
deliver workflow steps via email — with replies processed back into the workflow — makes the
platform accessible without any infrastructure requirement beyond a VPS.

---

## How the build is structured

The project uses a phased approach, with each phase having clear exit criteria before the next
begins. New contributors should read `docs/PLAN.md` for the full picture. In brief:

| Phase | Status | What it proved |
| --- | --- | --- |
| Phase 0 — Foundations | ✅ Complete | Monorepo, six core schemas, CLI validator, reference package |
| Phase 1 — Kernel | ✅ Complete | Package loader, agent runtime, memory, workflow engine, audit log, end-to-end headless test |
| Phase 2 — Headless completeness | ✅ Complete | `KernelApi` contract, file-backed persistence, full CLI, Electron shell parked |
| Phase 3 — Real agents & tools | 🚧 In progress | Real LLM via Ollama, tool calling, three-tier semantic memory, personas |
| Phase 4 — Ecosystem | Planned | Package signing, second domain package, Dapr Workflows runner |
| Phase 5 — UI | Planned | Full desktop and web portal, built on a proven kernel |

---

## Design rules that govern everything

These seven rules are load-bearing. Any PR that violates one should have a very good reason —
and probably needs a new ADR.

1. **Schemas first** — nothing consumes a format without a validating schema.
2. **Everything behind an interface** — `ModelProvider`, `VectorStore`, `StateStore`,
   `AuditSink` are swappable by deployment.
3. **No hardcoded agents or tools** — all behaviour comes from `.workforce` packages.
4. **Audit is runtime-enforced** — every agent step emits an immutable, hash-chained record.
5. **Human actions are authenticated and role-checked** — the kernel, not the UI, is the
   authorization authority.
6. **Every kernel capability must be exercisable from the CLI** before any UI work begins.
7. **Transport is an adapter concern** — email, messaging, portal and desktop are all adapters
   over `KernelApi`; the kernel never knows which transport is in use.

---

## How we work

- **ADRs for significant decisions.** Copy `docs/adr/template.md`, use the next number, write
  the context, decision and consequences. ADRs are immutable once accepted — write a new one
  to supersede, never edit history.
- **Plan.md as the living backlog.** `docs/PLAN.md` tracks phases, milestones, tasks and
  "learn while you build" notes. It is updated as each milestone completes.
- **Pair with Copilot.** Architecture decisions are worked through in conversation, then
  captured in ADRs. This document is itself an example: it began as a discussion and became a
  reference.
- **CI as the gate.** `pnpm test` must pass. The full `Grade7-Maths` workflow runs headlessly
  in CI. No milestone is done until CI is green.

---

## Where to go next

| Resource | What it is |
| --- | --- |
| [`README.md`](../README.md) | Quick start, core concepts, repo layout, design rules |
| [`docs/PLAN.md`](PLAN.md) | Detailed phase/milestone plan with learning notes |
| [`docs/adr/`](adr/README.md) | All architecture decisions, indexed |
| [`docs/phase-1-kernel-architecture.md`](phase-1-kernel-architecture.md) | Deep dive into the kernel packages |
| [`docs/pages-architecture.md`](pages-architecture.md) | Desktop/web shell and LLM integration plans |
| [`fixtures/Grade7-Maths.workforce/`](../fixtures/Grade7-Maths.workforce/) | The reference workforce package |
