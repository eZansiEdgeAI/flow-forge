export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface CompletionRequest {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
}
export interface CompletionResponse {
    content: string;
    model: string;
}
/**
 * Provider abstraction so a package can declare model needs per agent
 * ("Assessment needs a strong model, Coach can run on a small local one")
 * and deployments can map tiers to Ollama, an OpenAI-compatible API, or mocks.
 */
export interface ModelProvider {
    readonly name: string;
    complete(request: CompletionRequest): Promise<CompletionResponse>;
}
/** Deterministic provider for tests and offline development. */
export declare class MockModelProvider implements ModelProvider {
    private readonly responder;
    readonly name = "mock";
    constructor(responder: (request: CompletionRequest) => string);
    complete(request: CompletionRequest): Promise<CompletionResponse>;
}
/** Local models via the Ollama HTTP API. */
export declare class OllamaProvider implements ModelProvider {
    private readonly baseUrl;
    private readonly defaultModel;
    readonly name = "ollama";
    constructor(baseUrl?: string, defaultModel?: string);
    complete(request: CompletionRequest): Promise<CompletionResponse>;
}
/** Cloud models via any OpenAI-compatible chat completions API. */
export declare class OpenAICompatibleProvider implements ModelProvider {
    private readonly baseUrl;
    private readonly apiKey;
    private readonly defaultModel;
    readonly name = "openai-compatible";
    constructor(baseUrl: string, apiKey: string, defaultModel: string);
    complete(request: CompletionRequest): Promise<CompletionResponse>;
}
export type ModelTier = 'small' | 'medium' | 'large';
/** Maps agent model tiers to concrete providers. Deployment-specific. */
export declare class ModelRegistry {
    private providers;
    set(tier: ModelTier, provider: ModelProvider): this;
    get(tier: ModelTier): ModelProvider;
}
