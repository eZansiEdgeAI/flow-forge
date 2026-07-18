import type { IdentityProviderConfig } from '@flowforge/core';
/** Claims asserted by an identity provider about an authenticated user. */
export interface ClaimSet {
    sub: string;
    name?: string;
    email?: string;
    [claim: string]: unknown;
}
/** Tokens issued by a provider after a successful flow. */
export interface TokenSet {
    accessToken: string;
    idToken?: string;
    refreshToken?: string;
    /** Epoch milliseconds when the access token expires. */
    expiresAt?: number;
}
/** State for an in-flight authorization-code + PKCE flow. */
export interface AuthorizationRequest {
    url: string;
    state: string;
    codeVerifier: string;
}
/** State for an in-flight device-authorization flow (used by the CLI). */
export interface DeviceAuthorization {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    intervalSeconds: number;
    expiresInSeconds: number;
}
/**
 * Provider abstraction for OpenID Connect identity providers (ADR-0010).
 * Any compliant IdP works: Microsoft Entra ID, Google Workspace, Auth0,
 * Keycloak. Deployments enable providers via identity configuration; the
 * platform normalizes their claims into a FlowForge Principal.
 */
export interface IdentityProvider {
    readonly id: string;
    /** Begin an authorization-code + PKCE flow (interactive surfaces). */
    beginAuthorization(redirectUri: string): Promise<AuthorizationRequest>;
    /** Exchange an authorization code (plus PKCE verifier) for tokens. */
    exchangeCode(code: string, codeVerifier: string, redirectUri: string): Promise<TokenSet>;
    /** Begin a device-authorization flow (headless surfaces such as the CLI). */
    beginDeviceAuthorization(): Promise<DeviceAuthorization>;
    /** Poll for device-flow completion. Resolves undefined while authorization is pending. */
    pollDeviceAuthorization(deviceCode: string): Promise<TokenSet | undefined>;
    /** Refresh an expired token set. */
    refresh(refreshToken: string): Promise<TokenSet>;
    /** Validate tokens and return the provider's claims about the user. */
    claims(tokens: TokenSet): Promise<ClaimSet>;
}
/** Generic OIDC provider driven by the issuer's discovery document. */
export declare class OidcIdentityProvider implements IdentityProvider {
    readonly id: string;
    private readonly issuer;
    private readonly clientId;
    private readonly scopes;
    private discovery?;
    constructor(config: IdentityProviderConfig);
    private discover;
    beginAuthorization(redirectUri: string): Promise<AuthorizationRequest>;
    exchangeCode(code: string, codeVerifier: string, redirectUri: string): Promise<TokenSet>;
    beginDeviceAuthorization(): Promise<DeviceAuthorization>;
    pollDeviceAuthorization(deviceCode: string): Promise<TokenSet | undefined>;
    refresh(refreshToken: string): Promise<TokenSet>;
    claims(tokens: TokenSet): Promise<ClaimSet>;
    private tokenRequest;
}
/**
 * Deterministic provider for tests and offline development, mirroring
 * MockModelProvider: access tokens map directly to claim sets.
 */
export declare class MockIdentityProvider implements IdentityProvider {
    readonly id: string;
    private readonly tokenClaims;
    constructor(id?: string, tokenClaims?: Record<string, ClaimSet>);
    /** Register a user; the returned token authenticates as that user. */
    addUser(token: string, claims: ClaimSet): this;
    beginAuthorization(redirectUri: string): Promise<AuthorizationRequest>;
    exchangeCode(code: string): Promise<TokenSet>;
    beginDeviceAuthorization(): Promise<DeviceAuthorization>;
    pollDeviceAuthorization(deviceCode: string): Promise<TokenSet | undefined>;
    refresh(refreshToken: string): Promise<TokenSet>;
    claims(tokens: TokenSet): Promise<ClaimSet>;
}
