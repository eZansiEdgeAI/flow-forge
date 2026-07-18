# Meeting Minutes — Prompt Blocks

These prompts are used by an agent equipped with the `meeting-minutes` skill. Each block
addresses a distinct step in producing minutes from a conversation.

---

## Prompt 1 — Transcript Ingestion

Use this prompt to kick off the extraction process when given a raw conversation or a
pasted transcript.

```
You have been given a conversation between one or more humans and an AI agent. Your job
is to read the full conversation carefully and extract the following four things:

1. DECISIONS — commitments made, options chosen, things agreed upon. For each: state
   what was decided and the reason given (or infer it from context if obvious).

2. ACTION ITEMS — concrete tasks that need to be done. For each: identify the owner
   (or mark TBD), the task (verb-led, e.g. "Create the SKILL.md file"), and the
   priority (High / Medium / Low based on tone and urgency).

3. OPEN QUESTIONS — things raised but not resolved. For each: state the question
   clearly and who raised it.

4. KEY THEMES — the two or three main topics the conversation covered. These will
   form the backbone of the Summary section.

Do not produce the minutes yet. List your extractions in plain bullet form so they can
be reviewed before formatting. Label each section clearly.
```

---

## Prompt 2 — Formatting

Use this prompt once the extractions have been confirmed (or directly after Prompt 1 if
operating in single-pass mode).

```
Using the extractions above, produce the final meeting minutes in the exact Markdown
format specified in your SKILL.md instructions. Requirements:

- Fill in the header block: date (today's date in ISO 8601 format, YYYY-MM-DD),
  participants (use names if given; otherwise "Human" and "Agent"), and project
  (infer from context, or use "—" if not mentioned).
- Write the TL;DR first — one paragraph, 3–5 sentences, for someone who wasn't
  in the meeting.
- Write the Summary as a coherent narrative, 200–400 words. Do not copy the bullet
  extractions verbatim; synthesise them into flowing prose.
- Render Decisions, Action Items, and Open Questions as the specified Markdown tables.
- If a section is empty (e.g. no open questions), include the heading and write
  "None identified." rather than omitting the section.
- End with the italicised footer line exactly as specified in SKILL.md.

Output only the Markdown document. Do not add any commentary before or after it.
```

---

## Prompt 3 — Commit Suggestion

Use this prompt after the minutes Markdown has been produced, to suggest where and how
to save it.

```
The meeting minutes are ready. Suggest:

1. A filename following this pattern:
      docs/meetings/YYYY-MM-DD-<topic-slug>.md
   where <topic-slug> is a 2–4 word kebab-case summary of the main topic
   (e.g. "workforce-package-design", "phase-3-planning", "team-introduction").
   Use today's date.

2. A one-line git commit message in the conventional commits style:
      docs: add meeting minutes — <topic> (<date>)
   Keep it under 72 characters.

3. (Optional) If any action items involve creating or updating documentation, code
   files, or ADRs, list them as a short follow-up checklist so nothing is lost.

Output only the three items above, clearly labelled. Do not repeat the minutes.
```

---

## Example output (reference)

The document `docs/team-intro.md` in this repository is a real example of what this
skill produces: it began as an agent–human discussion about what FlowForge is and why
it was built, and was then structured into a team introduction document capturing the
conversation, decisions, and project context.

That document was produced manually; this skill automates and standardises the process
so any team can do the same after any significant conversation.
