# Sprint [N] Plan — [Project Name]
> **Produced by:** PM Agent
> **Date:** [DATE]
> **Sprint duration:** [e.g., 1 week / 2 weeks]
> **Status:** PLANNING → ACTIVE → COMPLETE

---

## Sprint Goal

> One sentence. What is the single most important outcome of this sprint?
> If everything else slips but this is done, was the sprint a success?

[TODO: Sprint goal — e.g., "Users can sign up, log in, and create their first item."]

---

## Scope

### In this sprint

> Stories selected for this sprint. Each must have a clear acceptance criterion.
> Maximum [N] stories per sprint — scope beyond this goes to backlog.

| ID | User Story | Acceptance Criteria | Complexity | Owner Agent |
|----|-----------|--------------------|-----------:|-------------|
| S1 | As a [user], I want [action] so that [outcome] | Given [...], when [...], then [...] | S / M / L | Backend / Frontend |
| S2 | ... | ... | ... | ... |

**Sprint capacity:** [N] stories — [N] selected — [N] remaining capacity

### Explicitly NOT in this sprint → Backlog

> Every excluded item must be documented. "Not now" is not the same as "never".

| Story | Reason deferred | Target sprint |
|-------|----------------|---------------|
| [Story description] | [e.g., depends on Sprint 1 auth foundation] | Sprint 2 |
| [Story description] | [e.g., nice-to-have, core value delivered without it] | Backlog |

---

## Definition of Done

> A story is DONE when ALL of these are true. Not "mostly done". All of them.

- [ ] All acceptance criteria pass (manual or automated)
- [ ] Unit tests written and passing for new logic
- [ ] E2E test case in `e2e/stories.spec.ts` passes
- [ ] No critical bugs in this story's scope
- [ ] `node orchestrate.js verify` passes (typecheck + build + tests)
- [ ] Code reviewed (if applicable)
- [ ] API contract updated in `api-contract.md` if API changed

---

## Sprint Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| [e.g., Auth integration unknown] | High | High | [Spike first, timebox to 1 day] |
| [e.g., Design spec incomplete for S3] | Medium | Medium | [QA Planning flags this in Kickoff meeting] |

---

## Sprint Metrics (filled in at Sprint Review)

| Metric | Planned | Actual |
|--------|---------|--------|
| Stories in sprint | [N] | — |
| Stories completed | — | — |
| Stories rolled to backlog | — | — |
| Critical bugs found | — | — |
| Velocity (stories/sprint) | — | — |

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| [DATE] | PM Agent | Sprint [N] plan created |
