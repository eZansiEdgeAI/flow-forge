"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Preload script (Task 2.1.4). Runs in the renderer's isolated world and
 * exposes a minimal, allow-listed API via contextBridge — the renderer never
 * gets ipcRenderer, Node or Electron internals. Compiled to CommonJS
 * (preload.cjs) because sandboxed preloads must be CJS.
 *
 * Channel strings are literals here (a sandboxed CJS preload cannot import
 * the ESM contract module), but `satisfies FlowForgeApi` keeps this file
 * type-checked against the shared contract in ipc.ts.
 */
const electron_1 = require("electron");
/** Compile-time guard: these literals must match the shared IpcChannels. */
const channels = {
    validatePackage: 'flowforge:validate-package',
    loadPackage: 'flowforge:load-package',
    startRun: 'flowforge:start-run',
    resumeRun: 'flowforge:resume-run',
    getRun: 'flowforge:get-run',
    getAuditTrail: 'flowforge:get-audit-trail',
    signIn: 'flowforge:sign-in',
    signOut: 'flowforge:sign-out',
    getCurrentUser: 'flowforge:get-current-user'
};
const api = {
    validatePackage: (packageDir) => electron_1.ipcRenderer.invoke(channels.validatePackage, packageDir),
    loadPackage: (packageDir) => electron_1.ipcRenderer.invoke(channels.loadPackage, packageDir),
    startRun: (packageId, workflowId) => electron_1.ipcRenderer.invoke(channels.startRun, packageId, workflowId),
    resumeRun: (runId, response) => electron_1.ipcRenderer.invoke(channels.resumeRun, runId, response),
    getRun: (runId) => electron_1.ipcRenderer.invoke(channels.getRun, runId),
    getAuditTrail: (runId) => electron_1.ipcRenderer.invoke(channels.getAuditTrail, runId),
    signIn: (role) => electron_1.ipcRenderer.invoke(channels.signIn, role),
    signOut: () => electron_1.ipcRenderer.invoke(channels.signOut),
    getCurrentUser: () => electron_1.ipcRenderer.invoke(channels.getCurrentUser)
};
electron_1.contextBridge.exposeInMainWorld('flowforge', api);
//# sourceMappingURL=preload.cjs.map