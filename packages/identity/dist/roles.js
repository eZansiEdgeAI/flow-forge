/**
 * Resolves FlowForge roles from provider claims using deployment-configured
 * mappings (ADR-0010). Packages declare the roles their workflows require;
 * deployments map IdP claims (e.g. group 'Staff') onto those roles.
 */
export class RoleMapper {
    mappings;
    constructor(mappings) {
        this.mappings = mappings;
    }
    resolve(providerId, claims) {
        const roles = new Set();
        for (const mapping of this.mappings) {
            if (mapping.provider && mapping.provider !== providerId)
                continue;
            const claimValue = claims[mapping.claim];
            const matches = Array.isArray(claimValue)
                ? claimValue.includes(mapping.value)
                : claimValue === mapping.value;
            if (matches)
                roles.add(mapping.role);
        }
        return [...roles];
    }
}
/** Maps validated provider claims plus resolved roles to a normalized Principal. */
export function toPrincipal(providerId, claims, roles, groupsClaim = 'groups') {
    const groups = claims[groupsClaim];
    return {
        id: claims.sub,
        displayName: claims.name,
        email: claims.email,
        provider: providerId,
        groups: Array.isArray(groups) ? groups : undefined,
        roles
    };
}
/**
 * Role-to-permission policy from identity configuration. When no permission
 * grants are configured, holding any role grants all permissions (a permissive
 * default suitable for development; production deployments should configure
 * explicit grants).
 */
export class PermissionPolicy {
    grants;
    constructor(grants) {
        this.grants = grants;
    }
    granted(principal, permission) {
        if (!this.grants)
            return principal.roles.length > 0;
        return principal.roles.some((role) => this.grants?.[role]?.includes(permission) ?? false);
    }
}
//# sourceMappingURL=roles.js.map