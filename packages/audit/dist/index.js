import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
export class InMemoryAuditSink {
    records = [];
    append(record) {
        this.records.push(record);
    }
    all() {
        return [...this.records];
    }
}
/** Append-only JSONL file sink. */
export class FileAuditSink {
    filePath;
    constructor(filePath) {
        this.filePath = filePath;
    }
    append(record) {
        appendFileSync(this.filePath, JSON.stringify(record) + '\n', 'utf8');
    }
    all() {
        if (!existsSync(this.filePath))
            return [];
        return readFileSync(this.filePath, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line));
    }
}
function contentHash(record) {
    return createHash('sha256').update(JSON.stringify(record)).digest('hex');
}
/**
 * Append-only, hash-chained audit log. Every agent step and human override
 * must emit a record; the chain makes tampering detectable.
 */
export class AuditLog {
    sink;
    lastHash;
    constructor(sink = new InMemoryAuditSink()) {
        this.sink = sink;
        const existing = sink.all();
        this.lastHash = existing.length > 0 ? existing[existing.length - 1].hash : 'genesis';
    }
    record(input) {
        const partial = {
            ...input,
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            previousHash: this.lastHash
        };
        const record = { ...partial, hash: contentHash(partial) };
        this.sink.append(record);
        this.lastHash = record.hash;
        return record;
    }
    all() {
        return this.sink.all();
    }
    /** Verify the hash chain end-to-end. Returns the index of the first bad record, or -1 if intact. */
    verify() {
        const records = this.sink.all();
        let previous = 'genesis';
        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const { hash, ...rest } = record;
            if (record.previousHash !== previous || contentHash(rest) !== hash)
                return i;
            previous = hash;
        }
        return -1;
    }
}
//# sourceMappingURL=index.js.map