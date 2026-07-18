import { type ModelProvider } from '@flowforge/agents';
import type { AuditFilter, AuditTrailSnapshot, HumanResponse, KernelApi, PackageSummary, PackageValidationResult, RunSnapshot, UserSnapshot } from './api.js';
export interface FlowForgeKernelOptions {
    /** Absolute path to a data directory for persistence.  Omit for in-memory. */
    dataDir?: string;
    /** Model provider override (defaults to MockModelProvider). */
    modelProvider?: ModelProvider;
}
export declare class FlowForgeKernel implements KernelApi {
    private readonly audit;
    private readonly stateStore;
    private readonly modelProvider;
    private readonly dataDir;
    /** Loaded packages, keyed by package id. */
    private readonly loadedPackages;
    /** Mapping from run id to its owning package and workflow. */
    private readonly runIndex;
    private identity?;
    private sessionId?;
    constructor(options?: FlowForgeKernelOptions);
    validatePackage(packageDir: string): PackageValidationResult;
    loadPackage(packageDir: string): PackageSummary;
    listPackages(): PackageSummary[];
    removePackage(packageId: string): void;
    startRun(packageId: string, workflowId: string): Promise<RunSnapshot>;
    resumeRun(runId: string, response: HumanResponse): Promise<RunSnapshot>;
    listRuns(packageId?: string): RunSnapshot[];
    getRun(runId: string): Promise<RunSnapshot | undefined>;
    getAuditTrail(filter?: AuditFilter): AuditTrailSnapshot;
    signIn(role: string): Promise<UserSnapshot>;
    signOut(): void;
    getCurrentUser(): UserSnapshot | undefined;
    /** Internal: load a package directory into memory without touching the registry file. */
    private loadPackageInternal;
    private entry;
    private currentPrincipal;
    /** Rebuild the dev identity service over all roles in all loaded packages. */
    private rebuildIdentity;
    private dataFilePath;
    private readJsonFile;
    private writeJsonFile;
    private savePackageRegistry;
    private saveRunIndex;
}
export type { AuditFilter, AuditTrailSnapshot, HumanResponse, KernelApi, PackageSummary, PackageValidationResult, PendingTaskSnapshot, RunSnapshot, UserSnapshot, WorkflowSummary, AgentSummary, } from './api.js';
