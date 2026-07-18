# 0012. Extend ModelProvider with tool calling capability

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The current `ModelProvider` interface (`packages/agents/src/providers.ts`) exposes a single
`complete(request)` method that sends a messages array and receives a plain text response. The
`AgentRuntime` then attempts to JSON-parse that text to extract structured output (score,
confidence, rubric section). This single-turn, text-in/text-out model has worked for the current
Grade7-Maths agents because each has a narrow, well-scoped job.

As the platform grows toward real knowledge retrieval, multi-step reasoning, and interaction with
external systems (read a rubric file, search the knowledge base, look up a student's history), the
text-parsing approach breaks down:

1. Models are not reliably JSON under all conditions, especially at the `small` and `medium` tiers.
2. There is no structured way for an agent to invoke actions (search memory, look up a rubric,
   fetch a document) and receive their results back into the same reasoning context.
3. Frameworks like Semantic Kernel, AutoGen, and LangChain were evaluated as replacements.
   They were rejected: they are heavy, opinionated, and would replace the `AgentRuntime`,
   `WorkflowEngine`, and `MemoryService` with their own abstractions — fighting every FlowForge
   design rule. The capability we need (tool calling) is already a first-class feature of the
   model APIs we use (Ollama with llama3.1/qwen2.5, OpenAI-compatible endpoints); we do not need
   a framework to access it.
4. All target models for real deployments — Ollama-hosted local models (`llama3.1`, `qwen2.5`,
   `mistral-nemo`), OpenAI, Azure OpenAI, Anthropic via compatible endpoints — support the
   OpenAI tool-calling protocol. Models must be tool-calling capable; this is now a minimum
   requirement when choosing models for agent tiers.

## Decision

We will extend the `ModelProvider` interface with a `completeWithTools` method alongside the
existing `complete` method. The existing method is preserved unchanged for simple, single-turn
completions and for the mock provider in tests.

```typescript
// New additions to providers.ts

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
}

export interface CompletionWithToolsRequest extends CompletionRequest {
  tools: ToolDefinition[];
}

export interface CompletionWithToolsResponse {
  content?: string;        // set when model produces a final text answer
  toolCalls?: ToolCall[];  // set when model wants to invoke tools
  model: string;
}

export interface ModelProvider {
  readonly name: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  completeWithTools?(
    request: CompletionWithToolsRequest,
    submitResults: (results: ToolResult[]) => Promise<CompletionWithToolsResponse>
  ): Promise<CompletionResponse>;
}
```

The `AgentRuntime.step()` method is extended to accept an optional `tools` array declared in the
agent definition (schema change). When tools are present and the provider supports
`completeWithTools`, the runtime runs a **ReAct loop**: reason → call tools → observe results →
reason again, until the model produces a final text/JSON response. Each tool invocation and its
result are appended as additional evidence entries in the audit record.

Tool implementations are registered functions provided at kernel composition time (not hardcoded
in the platform). A workforce package declares the tool names its agents may use; the deployment
wires the implementations. This preserves design rule 3 (no hardcoded agents/tools) and design
rule 4 (every agent step emits a full audit record, including all tool calls made during the
loop).

When `completeWithTools` is not implemented by a provider (e.g., the `MockModelProvider`),
the runtime falls back to the single-turn `complete` path — tests remain deterministic and
offline without modification.

Choosing which local model to run is a deployment decision (tier mapping in `ModelRegistry`).
Models must be tool-calling capable for agent nodes that declare tools. The package author guide
(`docs/authoring-packages.md`, Phase 4) will document this requirement.

## Consequences

Easier:
- Agents can reliably call structured actions (knowledge search, rubric lookup, memory write)
  without fragile JSON-in-text parsing.
- The ReAct loop pattern (reason → act → observe) is standard agentic-AI practice; adding it
  here means FlowForge agents behave like production AI agents, not glorified prompt templates.
- No dependency on Semantic Kernel, AutoGen, LangChain or any other agent framework — the tool
  protocol is already in the model APIs we target.
- `MockModelProvider` continues to work for all existing tests without change.
- Audit records become richer: every tool call during a step is traceable.

Harder:
- `OllamaProvider` and `OpenAICompatibleProvider` must implement `completeWithTools` — a
  moderate but bounded change, following the existing patterns in those classes.
- Package authors must understand tool-calling-capable model tiers; documentation required.
- The ReAct loop adds latency per step — acceptable for the use cases (knowledge retrieval is
  expensive either way) but something to monitor.

Follow-up work:
- Schema extension: add `tools: string[]` to `agent.schema.json` (Phase 3, alongside 3.2).
- `OllamaProvider.completeWithTools` implementation (Phase 3, Milestone 3.2).
- `OpenAICompatibleProvider.completeWithTools` implementation (Phase 3, Milestone 3.2).
- Knowledge-search and rubric-lookup tool implementations in the Grade7-Maths fixture (Phase 3,
  Milestone 3.3).
