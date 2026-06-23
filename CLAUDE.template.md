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

## Git Rules

### Project initialization
When the project is first created (before Spec Agent runs), initialize a git repository:

```bash
git init
git add .
git commit -m "chore: init project scaffold"
```

### Commit after every agent
After `node orchestrate.js advance <agent>` succeeds (not BLOCKED), immediately commit:

```bash
git add .
git commit -m "<type>(<agent>): <one-line summary of what was produced>"
```

Commit message format:

| Agent | Type | Example |
|---|---|---|
| spec | docs | `docs(spec): add requirements, use-cases, intent` |
| arch | docs | `docs(arch): ADR-001 — React + Express + MySQL` |
| pm | docs | `docs(pm): sprint-1 plan, 5 stories scoped` |
| design | docs | `docs(design): design-spec and tokens for sprint 1` |
| backend | feat | `feat(backend): implement auth, attendance, leave APIs` |
| frontend | feat | `feat(frontend): implement login, dashboard, attendance pages` |
| qa-planning | test | `test(qa): qa-plan and E2E skeletons for sprint 1` |
| qa-run | test | `test(qa): E2E tests complete, qa-report sprint 1` |

### Commit after meetings
After a meeting is RESOLVED, commit the meeting file:

```bash
git add meetings/
git commit -m "docs(meeting): sprint-1 kickoff resolved"
```

### Commit after checkpoints
After human approves a checkpoint:

```bash
git add cycle-state.json
git commit -m "chore: checkpoint A approved"
# or
git commit -m "chore: checkpoint B approved — sprint 1 complete"
```

### Never commit
- `.env` files
- `node_modules/`
- `verify-report.json` (generated artifact, not source)
- `.current-agent`

These are already in `.gitignore`.

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

`verify` is project-driven:
- Use `package.json` scripts when present (`typecheck`, `build`, `test`)
- Fall back to `tsconfig.json` for typecheck if no `typecheck` script exists
- Use optional `verify.config.json` to override commands or configure Lighthouse
- Skip checks that are not configured instead of assuming a fixed stack or port

```bash
# correct sequence
node orchestrate.js advance backend
# ... execute frontend agent ...
node orchestrate.js verify
node orchestrate.js advance frontend
```

**Before calling `advance frontend`, also confirm CSS framework setup is complete:**

```bash
# Tailwind setup check — all four must exist
ls tailwind.config.js postcss.config.js src/index.css
grep "@tailwind" src/index.css
grep "index.css" src/main.tsx index.html 2>/dev/null
```

If any of these fail, the frontend agent missed its CSS setup step. Have it create the missing files before advancing. A frontend that builds successfully but renders without styles is not complete.

---

## Sprint Boundary Enforcement

**Scope lock is absolute.** Once a sprint starts (after Kickoff meeting), no new stories can be added to the current sprint. This includes:

- Features the user mentions mid-sprint
- "Nice to have" additions discovered during implementation
- Bug fixes for issues outside the sprint scope (log separately as "out-of-scope critical" if needed)

When any agent encounters out-of-scope work:
1. Log it to `sprint-backlog.md` under "Discovered Mid-Sprint"
2. Continue with in-scope work
3. If it blocks a PLAN.md story, surface it as a Blocker — do NOT silently implement it

**Sprint transition:** When CHECKPOINT B is approved and sprint is complete, run:
```bash
node orchestrate.js sprint next
```
This archives the sprint, increments the counter, and resets sprint-level state. The next sprint starts fresh with a new PM run.

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
| pm | PLAN.md, sprint-N-plan.md, sprint-backlog.md (updated) + ADRs for sprint deferrals |
| design | design-spec.md, design-tokens.md + ADRs for UX pattern choices |
| backend | api-spec.yaml, api-samples.sh, schema.sql + ADRs for API / data model decisions |
| frontend | src/ (components, hooks, tests/), api-contract.md + ADRs for state / architecture choices |
| qa-planning | qa-plan.md, e2e/stories.spec.ts (skeleton) — raises testability concerns in Kickoff meeting |
| qa-run | qa-report.md, e2e/stories.spec.ts (completed) + ADRs for coverage exclusions / waived violations |
| orchestrator | DONE.md |
