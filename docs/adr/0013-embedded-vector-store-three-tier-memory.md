# 0013. Embedded vector store and three-tier memory model

- **Status:** Accepted
- **Date:** 2026-07-18
- **Amends:** [ADR-0007](0007-state-vs-memory-separation.md) (extends the namespace model)

## Context

ADR-0007 established that every agent owns its own memory namespace (`packageId/agentId`) inside
a `VectorStore`-backed `MemoryService`. The plan (Milestone 3.3) called for replacing the
`InMemoryVectorStore` with a **Chroma** adapter backed by real embeddings.

Two problems with that plan surfaced:

**1. Chroma requires a separate server process.**
Chroma is a standalone HTTP service (Python, Docker). Running it adds operational complexity
that is directly at odds with the deployment model FlowForge is targeting: a single low-cost
VPS or an offline classroom server where "install dependencies" should not mean "run Docker
Compose and maintain a Python service alongside the Node process". The entire point of Dapr
being considered in Phase 4 is scalable *hosted* infrastructure — an embedded store is correct
for self-contained deployments and the embedded store can be swapped at that layer.

**2. The two-tier namespace model (per-agent only) is insufficient once agents access large corpora.**
Agents will need access to:
- *Their own* accumulated episodic knowledge (what this agent has learned, per-run summaries,
  learner histories) — the existing per-agent namespace, correct as-is.
- *Shared package knowledge* (curriculum documents, rubrics, institutional policies, skill
  reference material declared in `SKILL.md`'s `embeddings` field) — currently the `embeddings`
  field in the skill manifest has no ingestion mechanism and no readable namespace.
- *Institutional long-term memory* (cohort-level patterns, cross-package organisational
  knowledge that all agents in a deployment can benefit from over time) — not expressible at all
  in the current model.

Forcing cross-agent knowledge through workflow state (as ADR-0007 suggests as the only
sanctioned route) is too coarse: it only persists for one run, is not semantically searchable,
and cannot accumulate over time.

**Frameworks evaluated:**
- **Chroma** — rejected (server dependency, wrong operational tier).
- **FAISS** — rejected (C++ native, no first-class Node/TypeScript support, same server-or-
  bundled complexity).
- **LanceDB** — accepted as the primary embedded option: TypeScript-native, file-backed (no
  server), Apache 2.0 licensed, supports real ANN search with embeddings, implements the
  existing `VectorStore` interface with no API changes.
- **sqlite-vec** — accepted as an alternative: SQLite with a vector extension, single-file,
  excellent if the deployment already uses SQLite for other data (audit, state). Requires a
  native module.

The existing `VectorStore` interface (four methods: `add`, `query`, `remove`, `list`) is
correct and does not need to change. The embedded adapter is an implementation swap.

## Decision

### 1. Replace Chroma with an embedded vector store (LanceDB or sqlite-vec)

We will ship a `LanceDBVectorStore` adapter implementing the existing `VectorStore` interface.
`sqlite-vec` is a named alternative for deployments that prefer a single SQLite file. The
`InMemoryVectorStore` remains for tests and offline development. No server or Docker dependency
is introduced.

Embeddings are generated via an `EmbeddingProvider` interface (mirroring `ModelProvider`):

```typescript
export interface EmbeddingProvider {
  readonly name: string;
  embed(texts: string[]): Promise<number[][]>;
}
```

For deployments running Ollama, the `nomic-embed-text` or `mxbai-embed-large` model provides
embeddings via the same Ollama API — no new service, same infrastructure. For cloud deployments,
any OpenAI-compatible embeddings endpoint (text-embedding-3-small etc.) works behind the same
interface. The `InMemoryVectorStore` continues to use lexical similarity in tests.

### 2. Extend the memory model to three tiers

| Tier | Namespace pattern | Owned by | Readable by | Written by |
|---|---|---|---|---|
| **Agent episodic** | `packageId/agentId` | Individual agent | That agent only | That agent (via workflow steps) |
| **Package knowledge** | `packageId/knowledge/skillName` | The package | All agents in the package | Ingestion at `loadPackage` time |
| **Institutional** | `orgId/institutional` | The deployment | All packages (policy-controlled) | Reflection agents; admin ingestion |

**Episodic tier:** unchanged from ADR-0007. Hard isolation. Agent A cannot read agent B's namespace.

**Package knowledge tier:**
- The `embeddings` field already exists in `SKILL.md` frontmatter (pointing at knowledge files
  such as `knowledge/algebra-notes.md`). At `loadPackage` time the kernel will chunk and embed
  those files into a `packageId/knowledge/skillName` namespace.
- Agents declare which knowledge namespaces they may read via a new `readNamespaces` field in
  `agent.schema.json`. This is additive — it does not replace the per-agent namespace, it
  supplements it. The field is schema-validated; an agent cannot read a namespace not listed.
- The `AgentRuntime` queries all declared `readNamespaces` (plus the agent's own) when building
  context for a step.

**Institutional tier:**
- A `orgId/institutional` namespace (or namespaces) configured at deployment level.
- Reflection agents may be granted write access to institutional namespaces via `writeNamespaces`
  (schema-validated).
- Read access to institutional namespaces is declared in the agent definition, just like package
  knowledge namespaces.
- This is the mechanism by which a Reflection agent can write a distilled cohort insight
  (`"this year's Grade 7 cohort struggles with two-step equations"`) that all agents in any
  package benefit from in subsequent runs.

### 3. Knowledge ingestion as a `loadPackage` step

`FlowForgeKernel.loadPackage` gains an ingestion step after validation:
1. For each skill's `embeddings` list, chunk the referenced files (fixed-size chunks with overlap).
2. Embed each chunk via the configured `EmbeddingProvider`.
3. Store in `packageId/knowledge/skillName` via the `VectorStore`.
4. Record a `package.knowledge.ingested` audit event with chunk count and skill name.

Ingestion is idempotent — re-loading the same package version skips chunks that are already
stored (content-hash checked). This means a teacher installing an updated curriculum package
automatically refreshes the knowledge store.

## Consequences

Easier:
- No server process to run or maintain for vector search. `LanceDB` is a file in `~/.flowforge`.
- Real semantic search (not lexical token-overlap) for large knowledge corpora — agents
  find the right rubric section even when the student's phrasing differs from the rubric keywords.
- Shared package knowledge is a first-class concept — curriculum files are not just static
  context in a prompt, they are a searchable, version-controlled, audited knowledge base.
- Institutional memory accumulates across runs, packages, and cohorts without manual curation.
- The `VectorStore` interface is unchanged — `InMemoryVectorStore` still works for all tests.
- Ollama already provides embedding models (no new service for local deployments).
- For Dapr-hosted deployments (Phase 4), a Dapr state-store-backed `VectorStore` adapter can
  be added alongside `LanceDB` without changing any agent or kernel code.

Harder:
- `loadPackage` now does async I/O (embedding calls) — loading a large knowledge base takes
  longer on first install (subsequent loads skip unchanged chunks).
- `agent.schema.json` gains `readNamespaces` and `writeNamespaces` fields — packages written
  before this change need review if they want shared knowledge access (the fields are optional;
  existing packages continue to work with per-agent namespaces only).
- Embedding model availability must be documented for each deployment tier (local Ollama vs cloud).

Follow-up work:
- `EmbeddingProvider` interface and `OllamaEmbeddingProvider` implementation (Phase 3, 3.3).
- `LanceDBVectorStore` adapter implementing `VectorStore` (Phase 3, 3.3).
- `agent.schema.json` schema extension: `readNamespaces`, `writeNamespaces` (Phase 3, 3.3).
- Ingestion step in `FlowForgeKernel.loadPackage` (Phase 3, 3.3).
- `flowforge memory list --namespace <ns>` extended to support non-agent namespaces (Phase 3, 3.3).
- Institutional namespace configuration in `identity.schema.json` or a new deployment config
  schema (Phase 4, alongside 4.2 second-package work).
- For Dapr deployments: a Dapr-backed `VectorStore` adapter (Phase 4, 4.3).
