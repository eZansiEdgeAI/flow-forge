import type { Principal, WorkflowDefinition } from '@flowforge/core';
import { AuditLog } from '@flowforge/audit';
import type { AgentRuntime } from '@flowforge/agents';
export type RunStatus = 'running' | 'waitingForHuman' | 'completed' | 'failed';
/** Thrown when a principal is not allowed to act on the pending human step. */
export declare class AuthorizationError extends Error {
    constructor(message: string);
}
export interface PendingHumanTask {
    nodeId: string;
    kind: 'input' | 'approval';
    role: string;
    prompt?: string;
    subject?: unknown;
}
export interface WorkflowRun {
    id: string;
    workflowId: string;
    status: RunStatus;
    currentNodeId?: string;
    state: Record<string, unknown>;
    pending?: PendingHumanTask;
    /** Per-run participant bindings: role → principal id of whoever first acted in that role. */
    participants?: Record<string, string>;
    error?: string;
}
/** Pluggable persistence for workflow state (transactional data, not memory). */
export interface StateStore {
    save(run: WorkflowRun): void;
    load(runId: string): WorkflowRun | undefined;
}
export declare class InMemoryStateStore implements StateStore {
    private runs;
    save(run: WorkflowRun): void;
    load(runId: string): WorkflowRun | undefined;
}
/** File-backed state store: persists each run as a JSON file in a directory. */
export declare class FileStateStore implements StateStore {
    private readonly dir;
    constructor(dir: string);
    save(run: WorkflowRun): void;
    load(runId: string): WorkflowRun | undefined;
}
export declare function evaluateCondition(expression: string, state: Record<string, unknown>): boolean;
/**
 * Embedded in-process workflow runner. Interprets the declarative workflow
 * spec: agent steps (with retries), human-input and human-approval steps
 * (pause/resume), branching and end nodes. The workflow definition is
 * portable; this engine is one of potentially several runners (a Dapr
 * Workflows runner can implement the same behaviour server-side).
 */
export declare class WorkflowEngine {
    private readonly agents;
    private readonly audit;
    private readonly store;
    constructor(agents: AgentRuntime, audit: AuditLog, store?: StateStore);
    start(workflow: WorkflowDefinition, initialState?: Record<string, unknown>): Promise<WorkflowRun>;
    /**
     * Resume a paused run with human input or an approval decision. The caller
     * must supply an authenticated Principal (ADR-0010); the engine verifies the
     * principal holds the pending node's role and, once someone has acted in a
     * role, binds that role to them for the rest of the run (only the student
     * who submitted may resubmit; only the assigned teacher may approve).
     * Failed checks emit an audited 'workflow.authorization.denied' event and
     * throw AuthorizationError without altering the run.
     */
    resume(workflow: WorkflowDefinition, runId: string, humanResponse: {
        principal: Principal;
        value?: unknown;
        approved?: boolean;
        reason?: string;
    }): Promise<WorkflowRun>;
    /** Role check plus per-run participant binding; denials are audited. */
    private authorize;
    getRun(runId: string): WorkflowRun | undefined;
    private node;
    private advance;
    private runAgentNode;
}
