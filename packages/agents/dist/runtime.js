import { createHash } from 'node:crypto';
import { MemoryService } from '@flowforge/memory';
function buildSystemPrompt(agent, persona, skillInstructions) {
    const parts = [];
    parts.push(agent.systemPrompt ?? `You are ${agent.name}. ${agent.role}`);
    for (const instructions of skillInstructions)
        parts.push(instructions);
    if (persona)
        parts.push(`Persona (${persona.name}): ${persona.promptOverlay}`);
    return parts.join('\n\n');
}
function tryParseJson(text) {
    const trimmed = text.trim().replace(/^```(?:json)?\n?/, '').replace(/```$/, '');
    try {
        return JSON.parse(trimmed);
    }
    catch {
        return text;
    }
}
/**
 * Generic agent executor. Loads agent config + skills + persona overlay from
 * the package, recalls relevant memory, calls the model provider, records an
 * audit record (runtime-enforced — there is no way to run a step without one)
 * and returns structured output.
 */
export class AgentRuntime {
    pkg;
    models;
    memory;
    audit;
    constructor(pkg, models, memory, audit) {
        this.pkg = pkg;
        this.models = models;
        this.memory = memory;
        this.audit = audit;
    }
    async step(request) {
        const agent = this.pkg.agents.get(request.agentId);
        if (!agent)
            throw new Error(`Unknown agent '${request.agentId}'`);
        const personaId = request.personaId ?? agent.defaultPersona;
        const persona = personaId ? this.pkg.personas.get(personaId) : undefined;
        if (personaId && !persona)
            throw new Error(`Unknown persona '${personaId}'`);
        const skillInstructions = [];
        for (const skillName of agent.skills ?? []) {
            const skill = this.pkg.skills.get(skillName);
            if (!skill)
                continue;
            const title = skill.manifest.metadata?.displayName ?? skill.manifest.name;
            skillInstructions.push(`Skill (${title}): ${skill.manifest.description}\n\n${skill.instructions}`.trim());
        }
        const systemPrompt = buildSystemPrompt(agent, persona, skillInstructions);
        const promptVersion = createHash('sha256').update(systemPrompt).digest('hex').slice(0, 12);
        const namespace = agent.memory?.namespace ?? MemoryService.namespace(this.pkg.manifest.id, agent.id);
        const recalled = agent.memory?.enabled === false
            ? []
            : await this.memory.recall(namespace, `${request.action} ${JSON.stringify(request.inputs)}`);
        const evidence = recalled.map((r) => ({
            source: `memory:${namespace}/${r.id}`,
            excerpt: r.text.slice(0, 200),
            relevance: r.relevance
        }));
        const userParts = [`Task: ${request.action}`];
        for (const [key, value] of Object.entries(request.inputs)) {
            userParts.push(`${key}:\n${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`);
        }
        if (recalled.length > 0) {
            userParts.push(`Relevant memory:\n${recalled.map((r) => `- ${r.text}`).join('\n')}`);
        }
        const provider = this.models.get(agent.model.tier);
        const completion = await provider.complete({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userParts.join('\n\n') }
            ],
            model: agent.model.preferredModel,
            temperature: agent.model.temperature
        });
        const output = tryParseJson(completion.content);
        const structured = (typeof output === 'object' && output !== null
            ? output
            : {});
        this.audit.record({
            actor: { type: 'agent', id: agent.id, persona: persona?.id },
            action: 'agent.step',
            workflowRunId: request.workflowRunId,
            nodeId: request.nodeId,
            packageId: this.pkg.manifest.id,
            inputRefs: Object.keys(request.inputs),
            promptVersion,
            model: { provider: provider.name, name: completion.model },
            evidence,
            score: typeof structured.score === 'number' ? structured.score : undefined,
            confidence: typeof structured.confidence === 'number' ? structured.confidence : undefined,
            rubricSection: typeof structured.rubricSection === 'string' ? structured.rubricSection : undefined,
            detail: { action: request.action }
        });
        return { output, raw: completion.content, model: completion.model, promptVersion, evidence };
    }
}
//# sourceMappingURL=runtime.js.map