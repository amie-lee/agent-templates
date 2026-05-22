# CLAUDE.md — Auto-pipeline rules

This file configures how Claude Code behaves in this project.

---

## Auto-pipeline rule

On session start in this project root:

1. Run `node orchestrate.js status` and read the output
2. If a file named `.current-agent` exists in the project root, immediately execute that agent's prompt from `agents/`
3. After every agent completes its work, always run `node orchestrate.js advance <agent-name>`
4. If `advance` does not report BLOCKED, automatically proceed to the next pending agent
5. **Pause at checkpoints** — do not auto-advance past CHECKPOINT A or B. Wait for the user to run `node orchestrate.js checkpoint <A|B>` before continuing.

---

## BLOCKED output format

When the pipeline cannot proceed, emit exactly:

```
PIPELINE STOPPED
Agent: <agent-name>
Missing: <filename>
Action needed: <specific description of what needs to be created or filled in>
```

Do not proceed past a BLOCKED state. Wait for the user to resolve the blocker, then re-run `node orchestrate.js status`.

---

## Agent execution order

```
spec → arch → [CHECKPOINT A] → pm
  → [KICKOFF MEETING] → design ∥ backend ∥ qa-planning
  → [CROSS-REVIEW MEETING] → frontend → qa-run
  → [SPRINT REVIEW MEETING] → [CHECKPOINT B] → done
```

- **spec** runs first. Produces `intake.md` before anything else — wait for human confirmation before continuing.
- **arch** reads `intake.md` first.
- **CHECKPOINT A** requires explicit human approval: `node orchestrate.js checkpoint A`
- **Kickoff meeting** runs after pm completes: `node orchestrate.js meeting start kickoff` — all agents attend before any sprint work begins.
- **design, backend, qa-planning** run in parallel — dispatch all three simultaneously after Kickoff meeting is RESOLVED.
- **Cross-review meeting** after design+backend complete: `node orchestrate.js meeting start cross-review` — must be RESOLVED before frontend starts.
- **frontend** reads the cross-review meeting before writing any code.
- **Sprint Review meeting** after qa-run: `node orchestrate.js meeting start sprint-review` — must be complete before CHECKPOINT B.
- **CHECKPOINT B** requires explicit human approval: `node orchestrate.js checkpoint B`

---

## Frontend verify step

After executing the frontend agent, run `node orchestrate.js verify` before calling `advance frontend`. This creates `verify-report.json`, which is required by QA's `validate()`.

```bash
# correct sequence
node orchestrate.js advance backend
# ... execute frontend agent ...
node orchestrate.js verify
node orchestrate.js advance frontend
```

---

## Meetings

Three mandatory meetings gate pipeline transitions. Each is a document in `meetings/` — agents write their sections independently, orchestrator resolves and closes.

| Meeting | Command | Blocks |
|---------|---------|--------|
| Kickoff | `node orchestrate.js meeting start kickoff` | Design+Backend+QA-Planning cannot start until RESOLVED |
| Cross-review | `node orchestrate.js meeting start cross-review` | Frontend cannot start until RESOLVED |
| Sprint Review | `node orchestrate.js meeting start sprint-review` | CHECKPOINT B cannot run until complete |

If a meeting is ESCALATED (unresolved blockers), pause the pipeline. Do not advance any agent. Wait for the human to resolve and re-run `meeting close`.

## Architecture Decision Records (ADRs)

Every agent writes ADRs in `adr/` for significant decisions. Claude Code must enforce this:

1. After each agent completes, run `node orchestrate.js adr` and check if the agent produced any expected ADRs.
2. If an agent made a significant decision (scope cut, tech choice, design deviation, contract change) but wrote no ADR, surface this before running `advance`.
3. When an agent writes a new ADR file, remind it to update `adr/ADR-000-index.md`.

### ADR format
All ADRs use `adr/adr.template.md` as the base. Copy it, fill it in, do not modify the template itself.

### ADR naming convention
`ADR-NNN-[category]-[short-topic].md`
- Categories: `scope`, `arch`, `planning`, `design`, `backend`, `frontend`, `qa`
- Number sequentially from 001; Architecture Agent always writes ADR-001

---

## File produced by each agent

| Agent | Must produce |
|-------|-------------|
| spec | intake.md (FIRST — wait for human confirmation), requirements.md, use-cases.md, intent.md + ADRs |
| arch | architecture-decision.md (ADR-001 in adr/) + ADRs for secondary tech decisions |
| pm | PLAN.md + ADRs for sprint deferrals |
| design | design-spec.md, design-tokens.md + ADRs for UX pattern choices |
| backend | api-spec.yaml, api-samples.sh, schema.sql + ADRs for API / data model decisions |
| frontend | src/ (components, hooks, tests/), api-contract.md + ADRs for state / architecture choices |
| qa-planning | qa-plan.md, e2e/stories.spec.ts (skeleton) — raises testability concerns in Kickoff meeting |
| qa-run | qa-report.md, e2e/stories.spec.ts (completed) + ADRs for coverage exclusions / waived violations |
| orchestrator | DONE.md |
