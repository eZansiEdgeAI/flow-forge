import type { AuditEvidence, LoadedWorkforcePackage } from '@flowforge/core';
import { AuditLog } from '@flowforge/audit';
import { MemoryService } from '@flowforge/memory';
import type { ModelRegistry } from './providers.js';
export interface AgentStepRequest {
    agentId: string;
    action: string;
    /** Named inputs from workflow state, passed as context. */
    inputs: Record<string, unknown>;
    /** Persona override for this step; falls back to the agent's default. */
    personaId?: string;
    workflowRunId?: string;
    nodeId?: string;
}
export interface AgentStepResult {
    output: unknown;
    raw: string;
    model: string;
    promptVersion: string;
    evidence: AuditEvidence[];
}
/**
 * Generic agent executor. Loads agent config + skills + persona overlay from
 * the package, recalls relevant memory, calls the model provider, records an
 * audit record (runtime-enforced — there is no way to run a step without one)
 * and returns structured output.
 */
export declare class AgentRuntime {
    private readonly pkg;
    private readonly models;
    private readonly memory;
    private readonly audit;
    constructor(pkg: LoadedWorkforcePackage, models: ModelRegistry, memory: MemoryService, audit: AuditLog);
    step(request: AgentStepRequest): Promise<AgentStepResult>;
}
