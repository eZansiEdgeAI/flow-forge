import { randomUUID } from 'node:crypto';
export class InMemorySessionStore {
    sessions = new Map();
    create(principal, tokens, ttlMs) {
        const session = {
            id: randomUUID(),
            principal: structuredClone(principal),
            tokens: { ...tokens },
            expiresAt: Date.now() + ttlMs
        };
        this.sessions.set(session.id, session);
        return structuredClone(session);
    }
    get(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return undefined;
        if (session.expiresAt <= Date.now()) {
            this.sessions.delete(sessionId);
            return undefined;
        }
        return structuredClone(session);
    }
    revoke(sessionId) {
        this.sessions.delete(sessionId);
    }
}
//# sourceMappingURL=sessions.js.map