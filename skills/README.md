# FlowForge Reusable Skills

This directory contains **cross-domain, reusable skills** that can be dropped into any
`.workforce` package. They are not tied to any specific domain (education, HR, legal, etc.)
and are meant to demonstrate that FlowForge skills are composable and portable.

## What is a skill?

A skill is a folder containing a single `SKILL.md` file ([Agent Skills](https://agentskills.io)
format): YAML frontmatter manifest + Markdown instructions that are injected verbatim into the
system prompt of any agent equipped with the skill. Optional `prompts.md` files provide
additional structured prompting blocks.

See [docs/adr/0009-agent-skills-skill-md-format.md](../docs/adr/0009-agent-skills-skill-md-format.md)
for the full rationale and format spec.

## Available skills

| Skill | Folder | Description |
| --- | --- | --- |
| Meeting Minutes | [`meeting-minutes/`](meeting-minutes/) | Treats any agent–human discussion as a project meeting and produces structured minutes: summary, decisions, actions, open questions. |

## Using a skill in a workforce package

1. Copy the skill folder into your package's `skills/` directory (or reference it by path).
2. Add the relative path to the `SKILL.md` file in your `workforce.json` `skills` array.
3. Equip the relevant agent with the skill name in its agent definition.

```json
// workforce.json (excerpt)
{
  "skills": ["skills/meeting-minutes/SKILL.md"]
}
```

```json
// agents/facilitator.json (excerpt)
{
  "skills": ["meeting-minutes"]
}
```

## Adding a new skill

Copy an existing skill folder as a template, rename it (lowercase letters, digits and hyphens —
this becomes the skill's `name` and must match the folder name), and update the table above.
