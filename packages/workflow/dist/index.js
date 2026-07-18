import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { principalActor } from '@flowforge/core';
/** Thrown when a principal is not allowed to act on the pending human step. */
export class AuthorizationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthorizationError';
    }
}
export class InMemoryStateStore {
    runs = new Map();
    save(run) {
        this.runs.set(run.id, structuredClone(run));
    }
    load(runId) {
        const run = this.runs.get(runId);
        return run ? structuredClone(run) : undefined;
    }
}
/** File-backed state store: persists each run as a JSON file in a directory. */
export class FileStateStore {
    dir;
    constructor(dir) {
        this.dir = dir;
        mkdirSync(dir, { recursive: true });
    }
    save(run) {
        writeFileSync(join(this.dir, `${run.id}.json`), JSON.stringify(run), 'utf8');
    }
    load(runId) {
        const path = join(this.dir, `${runId}.json`);
        if (!existsSync(path))
            return undefined;
        return JSON.parse(readFileSync(path, 'utf8'));
    }
}
/** Evaluates simple branch conditions like "score >= 50" or "default" over state. */
const OPERATORS = ['>=', '<=', '==', '!=', '>', '<'];
export function evaluateCondition(expression, state) {
    if (expression === 'default')
        return true;
    const trimmed = expression.trim();
    const operator = OPERATORS.find((op) => trimmed.includes(op));
    if (!operator)
        throw new Error(`Unsupported condition expression: '${expression}'`);
    const index = trimmed.indexOf(operator);
    const path = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + operator.length).trim();
    if (!/^[a-zA-Z_][\w.]*$/.test(path) || rawValue.length === 0) {
        throw new Error(`Unsupported condition expression: '${expression}'`);
    }
    let left = state;
    for (const key of path.split('.')) {
        left = left?.[key];
    }
    let right;
    if (rawValue === 'true')
        right = true;
    else if (rawValue === 'false')
        right = false;
    else if (rawValue === 'null')
        right = null;
    else if (!Number.isNaN(Number(rawValue)))
        right = Number(rawValue);
    else
        right = rawValue.replace(/^['"]|['"]$/g, '');
    switch (operator) {
        case '==':
            return left === right;
        case '!=':
            return left !== right;
        case '>=':
            return Number(left) >= Number(right);
        case '<=':
            return Number(left) <= Number(right);
        case '>':
            return Number(left) > Number(right);
        case '<':
            return Number(left) < Number(right);
        default:
            throw new Error(`Unsupported operator: '${operator}'`);
    }
}
/**
 * Embedded in-process workflow runner. Interprets the declarative workflow
 * spec: agent steps (with retries), human-input and human-approval steps
 * (pause/resume), branching and end nodes. The workflow definition is
 * portable; this engine is one of potentially several runners (a Dapr
 * Workflows runner can implement the same behaviour server-side).
 */
export class WorkflowEngine {
    agents;
    audit;
    store;
    constructor(agents, audit, store = new InMemoryStateStore()) {
        this.agents = agents;
        this.audit = audit;
        this.store = store;
    }
    start(workflow, initialState = {}) {
        const run = {
            id: randomUUID(),
            workflowId: workflow.id,
            status: 'running',
            currentNodeId: workflow.start,
            state: { ...(workflow.state ?? {}), ...initialState }
        };
        this.audit.record({
            actor: { type: 'system', id: 'workflow-engine' },
            action: 'workflow.start',
            workflowRunId: run.id,
            detail: { workflowId: workflow.id }
        });
        return this.advance(workflow, run);
    }
    /**
     * Resume a paused run with human input or an approval decision. The caller
     * must supply an authenticated Principal (ADR-0010); the engine verifies the
     * principal holds the pending node's role and, once someone has acted in a
     * role, binds that role to them for the rest of the run (only the student
     * who submitted may resubmit; only the assigned teacher may approve).
     * Failed checks emit an audited 'workflow.authorization.denied' event and
     * throw AuthorizationError without altering the run.
     */
    async resume(workflow, runId, humanResponse) {
        const run = this.store.load(runId);
        if (!run)
            throw new Error(`Unknown run '${runId}'`);
        if (run.status !== 'waitingForHuman' || !run.pending || !run.currentNodeId) {
            throw new Error(`Run '${runId}' is not waiting for human input`);
        }
        const node = this.node(workflow, run.currentNodeId);
        const { principal } = humanResponse;
        const actor = principalActor(principal);
        if (node.type !== 'humanInput' && node.type !== 'humanApproval') {
            throw new Error(`Node '${node.id}' is not a human step`);
        }
        this.authorize(run, node.role, principal);
        run.participants = { ...run.participants, [node.role]: principal.id };
        if (node.type === 'humanInput') {
            run.state[node.output] = humanResponse.value;
            this.audit.record({
                actor,
                action: 'human.input',
                workflowRunId: run.id,
                nodeId: node.id,
                detail: { output: node.output }
            });
            run.currentNodeId = node.next;
        }
        else {
            const approved = humanResponse.approved === true;
            this.audit.record({
                actor,
                action: approved ? 'human.approval' : 'human.rejection',
                workflowRunId: run.id,
                nodeId: node.id,
                detail: { reason: humanResponse.reason ?? '', subject: node.subject ?? '' }
            });
            run.currentNodeId = approved ? (node.onApprove ?? node.next) : node.onReject;
            if (!run.currentNodeId) {
                throw new Error(`Approval node '${node.id}' has no target for decision`);
            }
        }
        run.pending = undefined;
        run.status = 'running';
        return this.advance(workflow, run);
    }
    /** Role check plus per-run participant binding; denials are audited. */
    authorize(run, role, principal) {
        let reason;
        if (!principal.roles.includes(role)) {
            reason = `principal does not hold role '${role}'`;
        }
        else {
            const boundTo = run.participants?.[role];
            if (boundTo && boundTo !== principal.id) {
                reason = `role '${role}' is bound to another participant for this run`;
            }
        }
        if (reason) {
            this.audit.record({
                actor: principalActor(principal),
                action: 'workflow.authorization.denied',
                workflowRunId: run.id,
                nodeId: run.currentNodeId,
                detail: { requiredRole: role, reason }
            });
            throw new AuthorizationError(`Not authorized to act on run '${run.id}': ${reason}`);
        }
    }
    getRun(runId) {
        return this.store.load(runId);
    }
    node(workflow, id) {
        const node = workflow.nodes.find((n) => n.id === id);
        if (!node)
            throw new Error(`Unknown node '${id}' in workflow '${workflow.id}'`);
        return node;
    }
    async advance(workflow, run) {
        try {
            while (run.status === 'running' && run.currentNodeId) {
                const node = this.node(workflow, run.currentNodeId);
                switch (node.type) {
                    case 'agent':
                        await this.runAgentNode(node, run);
                        run.currentNodeId = node.next;
                        break;
                    case 'humanInput':
                        run.status = 'waitingForHuman';
                        run.pending = {
                            nodeId: node.id,
                            kind: 'input',
                            role: node.role,
                            prompt: node.prompt
                        };
                        break;
                    case 'humanApproval': {
                        const approval = node;
                        run.status = 'waitingForHuman';
                        run.pending = {
                            nodeId: node.id,
                            kind: 'approval',
                            role: approval.role,
                            subject: approval.subject ? run.state[approval.subject] : undefined
                        };
                        break;
                    }
                    case 'branch': {
                        const branch = node;
                        const matched = branch.conditions.find((c) => evaluateCondition(c.when, run.state));
                        if (!matched)
                            throw new Error(`No branch condition matched at node '${node.id}'`);
                        run.currentNodeId = matched.next;
                        break;
                    }
                    case 'parallel':
                        throw new Error('Parallel nodes are not yet supported by the embedded runner');
                    case 'end':
                        run.status = 'completed';
                        run.currentNodeId = undefined;
                        this.audit.record({
                            actor: { type: 'system', id: 'workflow-engine' },
                            action: 'workflow.complete',
                            workflowRunId: run.id
                        });
                        break;
                }
            }
        }
        catch (error) {
            run.status = 'failed';
            run.error = error instanceof Error ? error.message : String(error);
            this.audit.record({
                actor: { type: 'system', id: 'workflow-engine' },
                action: 'workflow.fail',
                workflowRunId: run.id,
                nodeId: run.currentNodeId,
                detail: { error: run.error }
            });
        }
        this.store.save(run);
        return run;
    }
    async runAgentNode(node, run) {
        const maxAttempts = node.retry?.maxAttempts ?? 1;
        const inputs = {};
        for (const name of node.inputs ?? [])
            inputs[name] = run.state[name];
        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await this.agents.step({
                    agentId: node.agent,
                    action: node.action,
                    inputs,
                    personaId: node.persona,
                    workflowRunId: run.id,
                    nodeId: node.id
                });
                if (node.output)
                    run.state[node.output] = result.output;
                return;
            }
            catch (error) {
                lastError = error;
                this.audit.record({
                    actor: { type: 'system', id: 'workflow-engine' },
                    action: 'agent.step.retry',
                    workflowRunId: run.id,
                    nodeId: node.id,
                    detail: { attempt, error: error instanceof Error ? error.message : String(error) }
                });
            }
        }
        throw lastError instanceof Error
            ? lastError
            : new Error(`Agent node '${node.id}' failed after ${maxAttempts} attempts`);
    }
}
//# sourceMappingURL=index.js.map