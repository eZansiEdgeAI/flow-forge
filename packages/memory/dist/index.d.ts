export interface MemoryItem {
    id: string;
    text: string;
    metadata?: Record<string, string>;
    createdAt: string;
}
export interface RecallResult extends MemoryItem {
    relevance: number;
}
/**
 * Pluggable vector store. The in-memory implementation uses lexical similarity;
 * a Chroma adapter implements the same interface for production use.
 */
export interface VectorStore {
    add(collection: string, item: MemoryItem): Promise<void>;
    query(collection: string, text: string, limit: number): Promise<RecallResult[]>;
    remove(collection: string, id: string): Promise<void>;
    list(collection: string): Promise<MemoryItem[]>;
}
export declare class InMemoryVectorStore implements VectorStore {
    private collections;
    private collection;
    add(collection: string, item: MemoryItem): Promise<void>;
    query(collection: string, text: string, limit: number): Promise<RecallResult[]>;
    remove(collection: string, id: string): Promise<void>;
    list(collection: string): Promise<MemoryItem[]>;
}
/**
 * Memory service: every agent owns its own memory, namespaced by package and
 * agent id. Replacing an agent never loses another agent's memory.
 * Memory (accumulated knowledge) is deliberately separate from workflow state.
 */
export declare class MemoryService {
    private readonly store;
    constructor(store?: VectorStore);
    static namespace(packageId: string, agentId: string): string;
    remember(namespace: string, text: string, metadata?: Record<string, string>): Promise<MemoryItem>;
    recall(namespace: string, query: string, limit?: number): Promise<RecallResult[]>;
    forget(namespace: string, id: string): Promise<void>;
    list(namespace: string): Promise<MemoryItem[]>;
}
