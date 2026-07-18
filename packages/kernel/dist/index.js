/**
 * FlowForgeKernel — the reference KernelApi implementation (ADR-0011).
 *
 * Deliberately framework-free: no Electron, no HTTP server, no event loop
 * assumption.  Any transport adapter (Electron IPC, HTTP, direct call from
 * the CLI) wraps an instance of this class.
 *
 * Persistence (optional):
 *   Pass `{ dataDir: '/path/to/.flowforge' }` to enable cross-process state:
 *   - `{dataDir}/packages.json`    — installed package registry
 *   - `{dataDir}/run-index.json`   — run → {packageId, workflowId} mapping
 *   - `{dataDir}/runs/{id}.json`   — individual run state (FileStateStore)
 *   - `{dataDir}/audit.jsonl`      — hash-chained audit log (FileAuditSink)
 *
 *   Without `dataDir` (e.g. in tests) everything is in-memory.
 *
 * Identity: hosts a dev identity service (one mock user per workflow role).
 * Real OIDC authorization-code + PKCE is a Phase-5 UI concern (ADR-0011).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorkforcePackage, PackageValidationError } from '@flowforge/packages';
import { AuditLog, FileAuditSink } from '@flowforge/audit';
import { MemoryService } from '@flowforge/memory';
import { AgentRuntime, MockModelProvider, ModelRegistry } from '@flowforge/agents';
import { IdentityService } from '@flowforge/identity';
import { FileStateStore, InMemoryStateStore, WorkflowEngine } from '@flowforge/workflow';
function humanRoles(workflow) {
    return [
        ...new Set(workflow.nodes.flatMap((node) => node.type === 'humanInput' || node.type === 'humanApproval' ? [node.role] : []))
    ];
}
function toPackageSummary(pkg) {
    return {
        id: pkg.manifest.id,
        name: pkg.manifest.name,
        version: pkg.manifest.version,
        description: pkg.manifest.description,
        dir: pkg.rootDir,
        agents: [...pkg.agents.values()].map((agent) => ({
            id: agent.id,
            name: agent.name,
            role: agent.role,
            modelTier: agent.model.tier,
            skills: agent.skills ?? [],
            defaultPersona: agent.defaultPersona
        })),
        workflows: [...pkg.workflows.values()].map((workflow) => ({
            id: workflow.id,
            description: workflow.description,
            nodeCount: workflow.nodes.length,
            roles: humanRoles(workflow)
        }))
    };
}
function toRunSnapshot(run, packageId) {
    return {
        id: run.id,
        packageId,
        workflowId: run.workflowId,
        status: run.status,
        currentNodeId: run.currentNodeId,
        pending: run.pending,
        participants: run.participants,
        error: run.error
    };
}
function toUserSnapshot(principal) {
    return {
        id: principal.id,
        displayName: principal.displayName,
        provider: principal.provider,
        roles: principal.roles
    };
}
export class FlowForgeKernel {
    audit;
    stateStore;
    modelProvider;
    dataDir;
    /** Loaded packages, keyed by package id. */
    loadedPackages = new Map();
    /** Mapping from run id to its owning package and workflow. */
    runIndex = new Map();
    identity;
    sessionId;
    constructor(options = {}) {
        this.dataDir = options.dataDir;
        this.modelProvider =
            options.modelProvider ?? new MockModelProvider(() => JSON.stringify({ note: 'mock response' }));
        if (options.dataDir) {
            const runsDir = join(options.dataDir, 'runs');
            mkdirSync(runsDir, { recursive: true });
            this.stateStore = new FileStateStore(runsDir);
            this.audit = new AuditLog(new FileAuditSink(join(options.dataDir, 'audit.jsonl')));
            // Restore run index and package registry from disk.
            for (const [id, entry] of Object.entries(this.readJsonFile('run-index.json', {}))) {
                this.runIndex.set(id, entry);
            }
            for (const [, entry] of Object.entries(this.readJsonFile('packages.json', {}))) {
                try {
                    this.loadPackageInternal(entry.dir);
                }
                catch {
                    // skip packages whose directory is no longer valid
                }
            }
        }
        else {
            this.stateStore = new InMemoryStateStore();
            this.audit = new AuditLog();
        }
    }
    // ---- Packages -----------------------------------------------------------
    validatePackage(packageDir) {
        try {
            loadWorkforcePackage(packageDir);
            return { valid: true, errors: [] };
        }
        catch (error) {
            if (error instanceof PackageValidationError)
                return { valid: false, errors: error.errors };
            return { valid: false, errors: [error instanceof Error ? error.message : String(error)] };
        }
    }
    loadPackage(packageDir) {
        const summary = this.loadPackageInternal(packageDir);
        if (this.dataDir)
            this.savePackageRegistry();
        return summary;
    }
    listPackages() {
        return [...this.loadedPackages.values()].map(({ pkg }) => toPackageSummary(pkg));
    }
    removePackage(packageId) {
        this.loadedPackages.delete(packageId);
        this.rebuildIdentity();
        if (this.dataDir)
            this.savePackageRegistry();
    }
    // ---- Runs ---------------------------------------------------------------
    async startRun(packageId, workflowId) {
        const { pkg, engine } = this.entry(packageId);
        const workflow = pkg.workflows.get(workflowId);
        if (!workflow)
            throw new Error(`Unknown workflow '${workflowId}' in package '${packageId}'`);
        const run = await engine.start(workflow);
        this.runIndex.set(run.id, { packageId, workflowId });
        if (this.dataDir)
            this.saveRunIndex();
        return toRunSnapshot(run, packageId);
    }
    async resumeRun(runId, response) {
        const ref = this.runIndex.get(runId);
        if (!ref)
            throw new Error(`Unknown run '${runId}'`);
        const principal = this.currentPrincipal();
        if (!principal)
            throw new Error('Sign in before responding to a human task (ADR-0010)');
        const { pkg, engine } = this.entry(ref.packageId);
        const workflow = pkg.workflows.get(ref.workflowId);
        if (!workflow)
            throw new Error(`Unknown workflow '${ref.workflowId}' in package '${ref.packageId}'`);
        const run = await engine.resume(workflow, runId, { principal, ...response });
        return toRunSnapshot(run, ref.packageId);
    }
    listRuns(packageId) {
        const results = [];
        for (const [runId, ref] of this.runIndex) {
            if (packageId && ref.packageId !== packageId)
                continue;
            const run = this.stateStore.load(runId);
            if (run)
                results.push(toRunSnapshot(run, ref.packageId));
        }
        return results;
    }
    async getRun(runId) {
        const ref = this.runIndex.get(runId);
        if (!ref)
            return undefined;
        const run = this.stateStore.load(runId);
        return run ? toRunSnapshot(run, ref.packageId) : undefined;
    }
    // ---- Audit --------------------------------------------------------------
    getAuditTrail(filter) {
        let records = this.audit.all();
        if (filter?.runId)
            records = records.filter((r) => r.workflowRunId === filter.runId);
        if (filter?.actor)
            records = records.filter((r) => r.actor.id === filter.actor);
        if (filter?.action)
            records = records.filter((r) => r.action === filter.action);
        return { records, chainIntact: this.audit.verify() === -1 };
    }
    // ---- Identity -----------------------------------------------------------
    async signIn(role) {
        if (!this.identity)
            throw new Error('Load a package before signing in');
        if (this.sessionId)
            this.signOut();
        const session = await this.identity.login('dev', { accessToken: `dev-${role}` });
        this.sessionId = session.id;
        return toUserSnapshot(session.principal);
    }
    signOut() {
        if (this.identity && this.sessionId)
            this.identity.logout(this.sessionId);
        this.sessionId = undefined;
    }
    getCurrentUser() {
        const principal = this.currentPrincipal();
        return principal ? toUserSnapshot(principal) : undefined;
    }
    // ---- Private helpers ----------------------------------------------------
    /** Internal: load a package directory into memory without touching the registry file. */
    loadPackageInternal(packageDir) {
        const pkg = loadWorkforcePackage(packageDir);
        const models = new ModelRegistry()
            .set('small', this.modelProvider)
            .set('medium', this.modelProvider)
            .set('large', this.modelProvider);
        const engine = new WorkflowEngine(new AgentRuntime(pkg, models, new MemoryService(), this.audit), this.audit, this.stateStore);
        this.loadedPackages.set(pkg.manifest.id, { pkg, engine });
        this.rebuildIdentity();
        return toPackageSummary(pkg);
    }
    entry(packageId) {
        const entry = this.loadedPackages.get(packageId);
        if (!entry)
            throw new Error(`Package '${packageId}' is not loaded`);
        return entry;
    }
    currentPrincipal() {
        if (!this.identity || !this.sessionId)
            return undefined;
        return this.identity.getSession(this.sessionId)?.principal;
    }
    /** Rebuild the dev identity service over all roles in all loaded packages. */
    rebuildIdentity() {
        const roles = new Set();
        for (const { pkg } of this.loadedPackages.values()) {
            for (const workflow of pkg.workflows.values()) {
                for (const role of humanRoles(workflow))
                    roles.add(role);
            }
        }
        const config = {
            providers: [{ id: 'dev', type: 'mock' }],
            roleMappings: [...roles].map((role) => ({ claim: 'role', value: role, role }))
        };
        const service = IdentityService.fromConfig(config, this.audit);
        const provider = service.registry.get('dev');
        for (const role of roles) {
            provider.addUser(`dev-${role}`, { sub: `dev-${role}`, name: `Dev ${role}`, role });
        }
        this.identity = service;
        this.sessionId = undefined;
    }
    // ---- Persistence --------------------------------------------------------
    dataFilePath(name) {
        if (!this.dataDir)
            throw new Error('dataFilePath called without a dataDir configured');
        return join(this.dataDir, name);
    }
    readJsonFile(name, fallback) {
        const path = this.dataFilePath(name);
        if (!existsSync(path))
            return fallback;
        try {
            return JSON.parse(readFileSync(path, 'utf8'));
        }
        catch {
            return fallback;
        }
    }
    writeJsonFile(name, value) {
        writeFileSync(this.dataFilePath(name), JSON.stringify(value, null, 2), 'utf8');
    }
    savePackageRegistry() {
        const registry = {};
        for (const { pkg } of this.loadedPackages.values()) {
            registry[pkg.manifest.id] = { dir: pkg.rootDir };
        }
        this.writeJsonFile('packages.json', registry);
    }
    saveRunIndex() {
        this.writeJsonFile('run-index.json', Object.fromEntries(this.runIndex));
    }
}
//# sourceMappingURL=index.js.map