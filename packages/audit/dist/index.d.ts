import type { AuditRecord } from '@flowforge/core';
export type AuditRecordInput = Omit<AuditRecord, 'id' | 'timestamp' | 'hash' | 'previousHash'>;
/** Pluggable persistence for the audit chain. */
export interface AuditSink {
    append(record: AuditRecord): void;
    all(): AuditRecord[];
}
export declare class InMemoryAuditSink implements AuditSink {
    private records;
    append(record: AuditRecord): void;
    all(): AuditRecord[];
}
/** Append-only JSONL file sink. */
export declare class FileAuditSink implements AuditSink {
    private readonly filePath;
    constructor(filePath: string);
    append(record: AuditRecord): void;
    all(): AuditRecord[];
}
/**
 * Append-only, hash-chained audit log. Every agent step and human override
 * must emit a record; the chain makes tampering detectable.
 */
export declare class AuditLog {
    private readonly sink;
    private lastHash;
    constructor(sink?: AuditSink);
    record(input: AuditRecordInput): AuditRecord;
    all(): AuditRecord[];
    /** Verify the hash chain end-to-end. Returns the index of the first bad record, or -1 if intact. */
    verify(): number;
}
