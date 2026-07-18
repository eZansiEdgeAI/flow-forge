import { createHash, randomBytes } from 'node:crypto';
function base64Url(buffer) {
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function toTokenSet(data) {
    return {
        accessToken: data.access_token,
        idToken: data.id_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in !== undefined ? Date.now() + data.expires_in * 1000 : undefined
    };
}
/** Generic OIDC provider driven by the issuer's discovery document. */
export class OidcIdentityProvider {
    id;
    issuer;
    clientId;
    scopes;
    discovery;
    constructor(config) {
        if (!config.issuer || !config.clientId) {
            throw new Error(`OIDC provider '${config.id}' requires 'issuer' and 'clientId'`);
        }
        this.id = config.id;
        this.issuer = config.issuer.replace(/\/$/, '');
        this.clientId = config.clientId;
        this.scopes = config.scopes ?? ['openid', 'profile', 'email'];
    }
    async discover() {
        if (!this.discovery) {
            const response = await fetch(`${this.issuer}/.well-known/openid-configuration`);
            if (!response.ok)
                throw new Error(`OIDC discovery failed for '${this.id}': ${response.status}`);
            this.discovery = (await response.json());
        }
        return this.discovery;
    }
    async beginAuthorization(redirectUri) {
        const discovery = await this.discover();
        const codeVerifier = base64Url(randomBytes(32));
        const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest());
        const state = base64Url(randomBytes(16));
        const url = new URL(discovery.authorization_endpoint);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('client_id', this.clientId);
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('scope', this.scopes.join(' '));
        url.searchParams.set('state', state);
        url.searchParams.set('code_challenge', codeChallenge);
        url.searchParams.set('code_challenge_method', 'S256');
        return { url: url.toString(), state, codeVerifier };
    }
    async exchangeCode(code, codeVerifier, redirectUri) {
        const discovery = await this.discover();
        return this.tokenRequest(discovery.token_endpoint, {
            grant_type: 'authorization_code',
            code,
            code_verifier: codeVerifier,
            redirect_uri: redirectUri,
            client_id: this.clientId
        });
    }
    async beginDeviceAuthorization() {
        const discovery = await this.discover();
        if (!discovery.device_authorization_endpoint) {
            throw new Error(`Provider '${this.id}' does not support the device-authorization flow`);
        }
        const response = await fetch(discovery.device_authorization_endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: this.clientId, scope: this.scopes.join(' ') })
        });
        if (!response.ok)
            throw new Error(`Device authorization failed: ${response.status}`);
        const data = (await response.json());
        return {
            deviceCode: data.device_code,
            userCode: data.user_code,
            verificationUri: data.verification_uri,
            intervalSeconds: data.interval ?? 5,
            expiresInSeconds: data.expires_in
        };
    }
    async pollDeviceAuthorization(deviceCode) {
        const discovery = await this.discover();
        const response = await fetch(discovery.token_endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                device_code: deviceCode,
                client_id: this.clientId
            })
        });
        const data = (await response.json());
        if (data.error === 'authorization_pending' || data.error === 'slow_down')
            return undefined;
        if (data.error)
            throw new Error(`Device flow failed: ${data.error}`);
        return toTokenSet(data);
    }
    async refresh(refreshToken) {
        const discovery = await this.discover();
        return this.tokenRequest(discovery.token_endpoint, {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: this.clientId
        });
    }
    async claims(tokens) {
        const discovery = await this.discover();
        const response = await fetch(discovery.userinfo_endpoint, {
            headers: { authorization: 'Bearer ' + tokens.accessToken }
        });
        if (!response.ok)
            throw new Error(`Token validation failed for '${this.id}': ${response.status}`);
        return (await response.json());
    }
    async tokenRequest(endpoint, params) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(params)
        });
        if (!response.ok)
            throw new Error(`Token request failed for '${this.id}': ${response.status}`);
        return toTokenSet((await response.json()));
    }
}
/**
 * Deterministic provider for tests and offline development, mirroring
 * MockModelProvider: access tokens map directly to claim sets.
 */
export class MockIdentityProvider {
    id;
    tokenClaims;
    constructor(id = 'mock', tokenClaims = {}) {
        this.id = id;
        this.tokenClaims = new Map(Object.entries(tokenClaims));
    }
    /** Register a user; the returned token authenticates as that user. */
    addUser(token, claims) {
        this.tokenClaims.set(token, claims);
        return this;
    }
    async beginAuthorization(redirectUri) {
        return { url: `mock://authorize?redirect_uri=${encodeURIComponent(redirectUri)}`, state: 'mock-state', codeVerifier: 'mock-verifier' };
    }
    async exchangeCode(code) {
        return { accessToken: code };
    }
    async beginDeviceAuthorization() {
        return {
            deviceCode: 'mock-device-code',
            userCode: 'MOCK-1234',
            verificationUri: 'mock://device',
            intervalSeconds: 0,
            expiresInSeconds: 300
        };
    }
    async pollDeviceAuthorization(deviceCode) {
        return { accessToken: deviceCode };
    }
    async refresh(refreshToken) {
        return { accessToken: refreshToken, refreshToken };
    }
    async claims(tokens) {
        const claims = this.tokenClaims.get(tokens.accessToken);
        if (!claims)
            throw new Error(`Unknown token for mock provider '${this.id}'`);
        return claims;
    }
}
//# sourceMappingURL=providers.js.map