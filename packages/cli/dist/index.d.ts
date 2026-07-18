#!/usr/bin/env node
export declare function validateCommand(packageDir: string): number;
export declare function inspectCommand(packageDir: string): number;
export declare function runCommand(packageDir: string, workflowId: string, options?: {
    mock?: boolean;
    identityConfigPath?: string;
    answersPath?: string;
    dataDir?: string;
    watch?: boolean;
}): Promise<number>;
export declare function runsListCommand(options: {
    dataDir?: string;
    packageId?: string;
}): number;
export declare function runsShowCommand(runId: string, options: {
    dataDir?: string;
}): Promise<number>;
export declare function auditShowCommand(options: {
    runId?: string;
    actor?: string;
    action?: string;
    dataDir?: string;
}): number;
export declare function auditVerifyCommand(options: {
    dataDir?: string;
}): number;
export declare function auditExportCommand(options: {
    runId?: string;
    outputPath?: string;
    dataDir?: string;
}): number;
export declare function memoryListCommand(namespace: string, _options: {
    dataDir?: string;
}): Promise<number>;
export declare function memoryDeleteCommand(namespace: string, itemId: string, _options: {
    dataDir?: string;
}): Promise<number>;
