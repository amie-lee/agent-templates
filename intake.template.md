# Project Intake — [Project Name]
> **Produced by:** Spec Agent — first document in every cycle
> **Date:** [DATE]
> **Status:** DRAFT → CONFIRMED (update when human confirms interpretation is correct)

---

## 1. Raw Request

> Verbatim copy of what the human submitted. Do not paraphrase. Do not correct.

```
[PASTE THE HUMAN'S EXACT REQUEST HERE]
```

---

## 2. Agent Interpretation

> What the Spec Agent understood from the raw request.
> Written before asking any clarifying questions.
> The human will confirm or correct this.

### What is being built
[One sentence — the product/feature/system in plain language]

### Who it is for
[Primary user / stakeholder — who will use this?]

### Why now
[What triggered this request? Is there a deadline, a user pain point, a business event?]

### What success looks like
[How will the human know this was built correctly? What changes in the world?]

### Inferred project type
Select the closest match based on the raw request:

- [ ] **MVP / Proof of Concept** — validate an idea fast, expect to rewrite
- [ ] **Internal Tool** — small user base, operational efficiency focus
- [ ] **Customer-facing Product** — UX quality and reliability matter
- [ ] **Platform / API** — other systems depend on this; stability is critical
- [ ] **Data Pipeline** — throughput, correctness, and observability matter
- [ ] **Other:** [describe]

**Reasoning:** [Why this project type was inferred — one sentence citing something from the raw request]

---

## 3. Clarifying Q&A

> Record every question asked and every answer received.
> If the human provided no additional input, write "No clarification requested — proceeding on inference."

| # | Question | Answer | Impact on requirements |
|---|----------|--------|------------------------|
| Q1 | [Question asked] | [Human's answer] | [How this shapes requirements.md] |
| Q2 | [Question asked] | [Human's answer] | [Impact] |

---

## 4. Intent Summary

> Synthesized from raw request + Q&A. This becomes the core of `intent.md`.
> Written after Q&A is complete.

### Launch goal
[One sentence: what does a successful launch look like for this human?]

### Quality priorities (ranked)
> How the human's answers map to what matters most.

| Rank | Priority | Evidence from request/Q&A |
|------|----------|---------------------------|
| 1 | [e.g., Time to market] | [Quote or inference from request] |
| 2 | [e.g., Developer velocity] | [Quote or inference] |
| 3 | [e.g., Reliability] | [Quote or inference] |
| 4 | [e.g., Cost efficiency] | [Quote or inference] |
| 5 | [e.g., Security / compliance] | [Quote or inference] |

### Scale expectations
| Dimension | Value | Source |
|-----------|-------|--------|
| Initial users | [number or "unknown"] | [Stated / Inferred] |
| 12-month users | [number or "unknown"] | [Stated / Inferred] |
| Peak concurrent | [number or "unknown"] | [Stated / Inferred] |

### Key risks identified
> Risks visible at intake, before requirements are written.

- **Risk 1:** [What could cause this to fail?]
- **Risk 2:** [What is unknown that could change the scope significantly?]

---

## 5. Interpretation Confirmation

> The human must confirm or correct section 2 before requirements.md is written.
> Do not proceed to requirements until this section is filled.

**Confirmation status:** PENDING → CONFIRMED / REVISED

**Human's response:**
```
[Record the human's confirmation or correction here]
```

**Revisions made (if any):**
- [What changed based on the human's correction]

---

## Revision History

| Date | Author | Change |
|------|--------|--------|
| [DATE] | Spec Agent | Initial intake |
