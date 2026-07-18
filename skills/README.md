# Reusable Agent Skills

This directory contains **cross-domain, reusable skills** in the
[Agent Skills](https://agentskills.io) format. They are not tied to any specific project,
domain, or agent runtime — copy any skill folder into your project and equip any compatible
agent with it.

## What is a skill?

A skill is a folder containing a single `SKILL.md` file: YAML frontmatter (name, description,
optional metadata) plus a Markdown body that is injected into the system prompt of any agent
equipped with the skill. Optional `prompts.md` files provide structured prompting blocks for
specific tasks.

The format is compatible with Claude Code, GitHub Copilot, and any runtime that supports the
[Agent Skills](https://agentskills.io) convention.

## Available skills

| Skill | Folder | Description |
| --- | --- | --- |
| Meeting Minutes | [`meeting-minutes/`](meeting-minutes/) | Treats any agent–human discussion as a project meeting and produces structured minutes: TL;DR, summary, decisions, actions, open questions. |

## Using a skill

**Standalone (any agent runtime):** copy the skill folder into your project and point your
agent at the `SKILL.md` file. The Markdown body becomes part of the agent's system prompt.

**GitHub Copilot:** place the skill folder under `.github/skills/` in your repository (or
wherever your Copilot agent configuration points).

**Claude Code:** add the `SKILL.md` path to your agent's skill list in your project
configuration.

**FlowForge workforce packages:** copy the skill folder into your package's `skills/`
directory, add the path to the `skills` array in `workforce.json`, and reference the skill
by name in your agent definition.

## Adding a new skill

Copy an existing skill folder as a template. Rename the folder using lowercase letters, digits
and hyphens — this becomes the skill's `name` value in the frontmatter, and the two must match.
Update the table above.
