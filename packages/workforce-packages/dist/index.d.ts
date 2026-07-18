import { type LoadedSkill, type LoadedWorkforcePackage } from '@flowforge/core';
export declare class PackageValidationError extends Error {
    readonly errors: string[];
    constructor(message: string, errors: string[]);
}
/**
 * Parses a SKILL.md file (agentskills.io Agent Skills convention): YAML
 * frontmatter is the skill manifest, the Markdown body is the instructions.
 */
export declare function parseSkillFile(path: string, label: string): LoadedSkill;
/**
 * Loads and validates a directory-form .workforce package.
 * Validation covers schema conformance plus cross-references:
 * agents' skills/personas must exist, workflow nodes must reference known
 * agents and known node ids.
 */
export declare function loadWorkforcePackage(packageDir: string): LoadedWorkforcePackage;
