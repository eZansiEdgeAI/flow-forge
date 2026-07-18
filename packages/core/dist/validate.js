import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const SCHEMA_NAMES = [
    'workforce-package',
    'agent',
    'skill',
    'persona',
    'workflow',
    'audit-record',
    'identity'
];
const schemasDir = fileURLToPath(new URL('../schemas/', import.meta.url));
const ajv = new Ajv2020({ allErrors: true, strict: false });
/** ajv-formats ships CJS; depending on the loader it may appear as the function itself or as { default }. */
function getFormatApplier() {
    const candidate = addFormats;
    return typeof candidate === 'function' ? candidate : candidate.default;
}
getFormatApplier()(ajv);
const validators = new Map();
export function loadSchema(name) {
    return JSON.parse(readFileSync(`${schemasDir}${name}.schema.json`, 'utf8'));
}
function getValidator(name) {
    let v = validators.get(name);
    if (!v) {
        v = ajv.compile(loadSchema(name));
        validators.set(name, v);
    }
    return v;
}
/** Validate a document against one of the FlowForge core schemas. */
export function validate(name, document) {
    const validator = getValidator(name);
    const valid = validator(document);
    return {
        valid,
        errors: valid
            ? []
            : (validator.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? 'is invalid'}`)
    };
}
export function schemaNames() {
    return [...SCHEMA_NAMES];
}
//# sourceMappingURL=validate.js.map