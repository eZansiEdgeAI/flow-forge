import type { AuditRecord, IdentityConfig, Permission, Principal } from '@flowforge/core';
import { AuditLog } from '@flowforge/audit';
import { type IdentityProvider, type TokenSet } from './providers.js';
import { type Session, type SessionStore } from './sessions.js';
/** Config-driven registry so a deployment can enable multiple IdPs simultaneously. */
export declare class IdentityRegistry {
    private providers;
    set(provider: IdentityProvider): this;
    get(providerId: string): IdentityProvider;
    ids(): string[];
    /** Build a registry from validated identity configuration. */
    static fromConfig(config: IdentityConfig): IdentityRegistry;
}
/**
 * Front door for authentication and governance (ADR-0010). Authenticates
 * tokens against a configured provider, maps claims to a normalized Principal
 * with deployment-configured roles, manages sessions, and records every
 * authentication event (login, refresh, denied access) through the
 * hash-chained audit log.
 */
export declare class IdentityService {
    private readonly config;
    readonly registry: IdentityRegistry;
    private readonly audit;
    private readonly sessions;
    private readonly roleMapper;
    private readonly policy;
    private readonly sessionTtlMs;
    private readonly groupsClaims;
    constructor(config: IdentityConfig, registry: IdentityRegistry, audit: AuditLog, sessions?: SessionStore);
    static fromConfig(config: IdentityConfig, audit: AuditLog, sessions?: SessionStore): IdentityService;
    /** Validate tokens with a provider, resolve roles and open an audited session. */
    login(providerId: string, tokens: TokenSet): Promise<Session>;
    /** Resolve a live session; returns undefined when unknown or expired. */
    getSession(sessionId: string): Session | undefined;
    /** Refresh the tokens of a live session, keeping the audit trail. */
    refresh(sessionId: string): Promise<Session>;
    /** Revoke a session (logout). */
    logout(sessionId: string): void;
    /** Check a permission grant; denied checks are audited for governance review. */
    authorize(principal: Principal, permission: Permission): boolean;
    /** Governance: the full audit trail attributable to one user. */
    auditTrailForUser(userId: string): AuditRecord[];
    /** Governance: the effective claim-to-role mappings for review. */
    roleMappings(): IdentityConfig['roleMappings'];
}
