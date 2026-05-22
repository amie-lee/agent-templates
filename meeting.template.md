# Meeting: [Type] — Sprint [N] — [Date]
> **Facilitated by:** Orchestrator Agent
> **Type:** KICKOFF | CROSS-REVIEW | SPRINT-REVIEW
> **Status:** OPEN → IN-PROGRESS → RESOLVED | ESCALATED
> **Triggered by:** [What event caused this meeting — e.g., "PLAN.md completed"]

---

## Purpose

[One sentence: what does this meeting need to achieve?]

---

## Agenda

1. [Item 1 — e.g., Review PLAN.md and surface risks]
2. [Item 2 — e.g., Confirm inter-agent dependencies]
3. [Item 3 — e.g., Resolve open questions before dispatch]

---

## Context (read before attending)

> Artifacts each attendee should read before writing their section.

| Agent | Read before attending |
|-------|-----------------------|
| [Agent name] | [filename(s)] |
| [Agent name] | [filename(s)] |

---

## Attendance

| Agent | Status | Attended at |
|-------|--------|-------------|
| [Agent name] | PENDING / ATTENDED / SKIPPED | [timestamp or —] |

---

## Discussion

> Each attending agent writes their section independently.
> Format per agent: Approvals → Concerns → Blockers → Questions.
> Be specific — cite file names, section names, requirement IDs.

---

### [Agent Name] — Review

**Approvals** *(what looks good and is confirmed)*
- [e.g., The API contract in api-spec.yaml covers all the endpoints I need for UC-001 and UC-002.]

**Concerns** *(issues that should be addressed but don't block)*
- [e.g., The design-spec.md does not specify an empty state for the user list component. I'll need to infer this.]

**Blockers** *(must be resolved before this agent can proceed)*
- [e.g., api-spec.yaml is missing the /users/{id}/settings endpoint referenced in UC-004. Cannot build this feature without it.]

**Questions** *(need clarification from another agent or human)*
- [e.g., @Backend: The error response for 401 is `{ "error": "string" }` in the spec, but the design shows a full-page error screen. Which takes precedence?]

---

### [Next Agent Name] — Review

**Approvals**
- [...]

**Concerns**
- [...]

**Blockers**
- [...]

**Questions**
- [...]

---

## Resolutions

> Orchestrator writes this section after all agents have attended.
> For each Blocker and Question, record the resolution and who decided it.

| # | Issue | Resolution | Decided by | ADR? |
|---|-------|------------|------------|------|
| 1 | [Blocker or Question text] | [How it was resolved] | [Agent or Human] | ADR-NNN / — |

---

## Unresolved Items → Escalation

> Items that could not be resolved by agents and require human input.
> If this section is non-empty, status becomes ESCALATED and pipeline pauses.

- [ ] [Unresolved issue — what decision is needed from the human?]

---

## Outcome

**Status:** RESOLVED | ESCALATED

**Next step:**
- [ ] [Agent name] may now proceed with [artifact]
- [ ] [If escalated] Human must decide: [specific question] then run `node orchestrate.js meeting close [filename]`

**ADRs produced by this meeting:**
- [ADR-NNN filename, or "none"]

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| [DATE] | Orchestrator | Meeting opened |
| [DATE] | [Agent] | Attended |
| [DATE] | Orchestrator | Resolved / Escalated |
