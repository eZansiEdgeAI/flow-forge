import { randomUUID } from 'node:crypto';
function tokenize(text) {
    return new Set(text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 2));
}
function similarity(a, b) {
    const ta = tokenize(a);
    const tb = tokenize(b);
    if (ta.size === 0 || tb.size === 0)
        return 0;
    let overlap = 0;
    for (const t of ta)
        if (tb.has(t))
            overlap++;
    return overlap / Math.sqrt(ta.size * tb.size);
}
export class InMemoryVectorStore {
    collections = new Map();
    collection(name) {
        let c = this.collections.get(name);
        if (!c) {
            c = [];
            this.collections.set(name, c);
        }
        return c;
    }
    async add(collection, item) {
        this.collection(collection).push(item);
    }
    async query(collection, text, limit) {
        return this.collection(collection)
            .map((item) => ({ ...item, relevance: similarity(text, item.text) }))
            .filter((r) => r.relevance > 0)
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, limit);
    }
    async remove(collection, id) {
        const c = this.collection(collection);
        const index = c.findIndex((item) => item.id === id);
        if (index >= 0)
            c.splice(index, 1);
    }
    async list(collection) {
        return [...this.collection(collection)];
    }
}
/**
 * Memory service: every agent owns its own memory, namespaced by package and
 * agent id. Replacing an agent never loses another agent's memory.
 * Memory (accumulated knowledge) is deliberately separate from workflow state.
 */
export class MemoryService {
    store;
    constructor(store = new InMemoryVectorStore()) {
        this.store = store;
    }
    static namespace(packageId, agentId) {
        return `${packageId}/${agentId}`;
    }
    async remember(namespace, text, metadata) {
        const item = {
            id: randomUUID(),
            text,
            metadata,
            createdAt: new Date().toISOString()
        };
        await this.store.add(namespace, item);
        return item;
    }
    async recall(namespace, query, limit = 5) {
        return this.store.query(namespace, query, limit);
    }
    async forget(namespace, id) {
        return this.store.remove(namespace, id);
    }
    async list(namespace) {
        return this.store.list(namespace);
    }
}
//# sourceMappingURL=index.js.map