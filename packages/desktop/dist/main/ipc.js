/**
 * Typed IPC contract shared between the Electron main process and the
 * renderer (Task 2.1.2). Snapshot types now live in @flowforge/kernel so
 * they can be shared with the CLI and any future transport adapter.
 * This file re-exports those types and adds the Electron-specific channel
 * names and the renderer-facing async FlowForgeApi.
 */
/** Channel names — the preload and main process must agree on these. */
export const IpcChannels = {
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
//# sourceMappingURL=ipc.js.map