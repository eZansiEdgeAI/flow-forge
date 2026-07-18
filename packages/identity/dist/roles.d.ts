import type { IdentityConfig, Permission, Principal, RoleMapping } from '@flowforge/core';
import type { ClaimSet } from './providers.js';
/**
 * Resolves FlowForge roles from provider claims using deployment-configured
 * mappings (ADR-0010). Packages declare the roles their workflows require;
 * deployments map IdP claims (e.g. group 'Staff') onto those roles.
 */
export declare class RoleMapper {
    private readonly mappings;
    constructor(mappings: RoleMapping[]);
    resolve(providerId: string, claims: ClaimSet): string[];
}
/** Maps validated provider claims plus resolved roles to a normalized Principal. */
export declare function toPrincipal(providerId: string, claims: ClaimSet, roles: string[], groupsClaim?: string): Principal;
/**
 * Role-to-permission policy from identity configuration. When no permission
 * grants are configured, holding any role grants all permissions (a permissive
 * default suitable for development; production deployments should configure
 * explicit grants).
 */
export declare class PermissionPolicy {
    private readonly grants?;
    constructor(grants?: IdentityConfig['permissions']);
    granted(principal: Principal, permission: Permission): boolean;
}
