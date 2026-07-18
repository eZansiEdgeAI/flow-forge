import type { Principal } from '@flowforge/core';
import type { TokenSet } from './providers.js';
export interface Session {
    id: string;
    principal: Principal;
    tokens: TokenSet;
    /** Epoch milliseconds when the session expires (deployment session policy). */
    expiresAt: number;
}
/**
 * Dedicated, pluggable session persistence (ADR-0010). Sessions are security
 * material with their own lifecycle and deliberately live outside the
 * workflow StateStore.
 */
export interface SessionStore {
    create(principal: Principal, tokens: TokenSet, ttlMs: number): Session;
    get(sessionId: string): Session | undefined;
    revoke(sessionId: string): void;
}
export declare class InMemorySessionStore implements SessionStore {
    private sessions;
    create(principal: Principal, tokens: TokenSet, ttlMs: number): Session;
    get(sessionId: string): Session | undefined;
    revoke(sessionId: string): void;
}
