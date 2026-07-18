/** Domain types mirroring the JSON Schemas in ../schemas. Schemas are the source of truth. */
/** Build the audit actor entry for an authenticated principal (verified identity, ADR-0010). */
export function principalActor(principal) {
    return {
        type: 'human',
        id: principal.id,
        provider: principal.provider,
        roles: principal.roles
    };
}
//# sourceMappingURL=types.js.map