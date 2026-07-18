/** Deterministic provider for tests and offline development. */
export class MockModelProvider {
    responder;
    name = 'mock';
    constructor(responder) {
        this.responder = responder;
    }
    async complete(request) {
        return { content: this.responder(request), model: 'mock' };
    }
}
/** Local models via the Ollama HTTP API. */
export class OllamaProvider {
    baseUrl;
    defaultModel;
    name = 'ollama';
    constructor(baseUrl = 'http://localhost:11434', defaultModel = 'llama3.2') {
        this.baseUrl = baseUrl;
        this.defaultModel = defaultModel;
    }
    async complete(request) {
        const model = request.model ?? this.defaultModel;
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: request.messages,
                stream: false,
                options: request.temperature !== undefined ? { temperature: request.temperature } : undefined
            })
        });
        if (!response.ok)
            throw new Error(`Ollama request failed: ${response.status}`);
        const data = (await response.json());
        return { content: data.message.content, model };
    }
}
/** Cloud models via any OpenAI-compatible chat completions API. */
export class OpenAICompatibleProvider {
    baseUrl;
    apiKey;
    defaultModel;
    name = 'openai-compatible';
    constructor(baseUrl, apiKey, defaultModel) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.defaultModel = defaultModel;
    }
    async complete(request) {
        const model = request.model ?? this.defaultModel;
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({ model, messages: request.messages, temperature: request.temperature })
        });
        if (!response.ok)
            throw new Error(`Model request failed: ${response.status}`);
        const data = (await response.json());
        return { content: data.choices[0]?.message.content ?? '', model };
    }
}
/** Maps agent model tiers to concrete providers. Deployment-specific. */
export class ModelRegistry {
    providers = new Map();
    set(tier, provider) {
        this.providers.set(tier, provider);
        return this;
    }
    get(tier) {
        const provider = this.providers.get(tier);
        if (!provider)
            throw new Error(`No model provider registered for tier '${tier}'`);
        return provider;
    }
}
//# sourceMappingURL=providers.js.map