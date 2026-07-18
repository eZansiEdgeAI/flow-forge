export type SchemaName = 'workforce-package' | 'agent' | 'skill' | 'persona' | 'workflow' | 'audit-record' | 'identity';
export declare function loadSchema(name: SchemaName): Record<string, unknown>;
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
/** Validate a document against one of the FlowForge core schemas. */
export declare function validate(name: SchemaName, document: unknown): ValidationResult;
export declare function schemaNames(): SchemaName[];
