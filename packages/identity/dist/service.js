import { principalActor, validate } from '@flowforge/core';
import { MockIdentityProvider, OidcIdentityProvider } from './providers.js';
import { PermissionPolicy, RoleMapper, toPrincipal } from './roles.js';
import { InMemorySessionStore } from './sessions.js';
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** Config-driven registry so a deployment can enable multiple IdPs simultaneously. */
export class IdentityRegistry {
    providers = new Map();
    set(provider) {
        this.providers.set(provider.id, provider);
        return this;
    }
    get(providerId) {
        const provider = this.providers.get(providerId);
        if (!provider)
            throw new Error(`No identity provider registered with id '${providerId}'`);
        return provider;
    }
    ids() {
        return [...this.providers.keys()];
    }
    /** Build a registry from validated identity configuration. */
    static fromConfig(config) {
        const result = validate('identity', config);
        if (!result.valid) {
            throw new Error(`Invalid identity configuration:\n${result.errors.map((e) => `  - ${e}`).join('\n')}`);
        }
        const registry = new IdentityRegistry();
        for (const providerConfig of config.providers) {
            registry.set(providerConfig.type === 'mock'
                ? new MockIdentityProvider(providerConfig.id)
                : new OidcIdentityProvider(providerConfig));
        }
        return registry;
    }
}
/**
 * Front door for authentication and governance (ADR-0010). Authenticates
 * tokens against a configured provider, maps claims to a normalized Principal
 * with deployment-configured roles, manages sessions, and records every
 * authentication event (login, refresh, denied access) through the
 * hash-chained audit log.
 */
export class IdentityService {
    config;
    registry;
    audit;
    sessions;
    roleMapper;
    policy;
    sessionTtlMs;
    groupsClaims;
    constructor(config, registry, audit, sessions = new InMemorySessionStore()) {
        this.config = config;
        this.registry = registry;
        this.audit = audit;
        this.sessions = sessions;
        this.roleMapper = new RoleMapper(config.roleMappings);
        this.policy = new PermissionPolicy(config.permissions);
        this.sessionTtlMs = config.session?.ttlSeconds !== undefined ? config.session.ttlSeconds * 1000 : DEFAULT_SESSION_TTL_MS;
        this.groupsClaims = new Map(config.providers.map((p) => [p.id, p.groupsClaim ?? 'groups']));
    }
    static fromConfig(config, audit, sessions) {
        return new IdentityService(config, IdentityRegistry.fromConfig(config), audit, sessions);
    }
    /** Validate tokens with a provider, resolve roles and open an audited session. */
    async login(providerId, tokens) {
        const provider = this.registry.get(providerId);
        let principal;
        try {
            const claims = await provider.claims(tokens);
            const roles = this.roleMapper.resolve(providerId, claims);
            principal = toPrincipal(providerId, claims, roles, this.groupsClaims.get(providerId));
        }
        catch (error) {
            this.audit.record({
                actor: { type: 'system', id: 'identity-service' },
                action: 'identity.login.denied',
                detail: { provider: providerId, error: error instanceof Error ? error.message : String(error) }
            });
            throw error;
        }
        const session = this.sessions.create(principal, tokens, this.sessionTtlMs);
        this.audit.record({
            actor: principalActor(principal),
            action: 'identity.login',
            detail: { sessionId: session.id, expiresAt: new Date(session.expiresAt).toISOString() }
        });
        return session;
    }
    /** Resolve a live session; returns undefined when unknown or expired. */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    /** Refresh the tokens of a live session, keeping the audit trail. */
    async refresh(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error(`Unknown or expired session '${sessionId}'`);
        if (!session.tokens.refreshToken)
            throw new Error(`Session '${sessionId}' has no refresh token`);
        const provider = this.registry.get(session.principal.provider);
        const tokens = await provider.refresh(session.tokens.refreshToken);
        this.sessions.revoke(sessionId);
        const renewed = this.sessions.create(session.principal, tokens, this.sessionTtlMs);
        this.audit.record({
            actor: principalActor(session.principal),
            action: 'identity.refresh',
            detail: { previousSessionId: sessionId, sessionId: renewed.id }
        });
        return renewed;
    }
    /** Revoke a session (logout). */
    logout(sessionId) {
        const session = this.sessions.get(sessionId);
        this.sessions.revoke(sessionId);
        if (session) {
            this.audit.record({
                actor: principalActor(session.principal),
                action: 'identity.logout',
                detail: { sessionId }
            });
        }
    }
    /** Check a permission grant; denied checks are audited for governance review. */
    authorize(principal, permission) {
        const granted = this.policy.granted(principal, permission);
        if (!granted) {
            this.audit.record({
                actor: principalActor(principal),
                action: 'identity.permission.denied',
                detail: { permission }
            });
        }
        return granted;
    }
    /** Governance: the full audit trail attributable to one user. */
    auditTrailForUser(userId) {
        return this.audit.all().filter((record) => record.actor.type === 'human' && record.actor.id === userId);
    }
    /** Governance: the effective claim-to-role mappings for review. */
    roleMappings() {
        return structuredClone(this.config.roleMappings);
    }
}
//# sourceMappingURL=service.js.map