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
spec → arch → [CHECKPOINT A: human approval] → pm → design∥backend → frontend → qa → [CHECKPOINT B: human approval] → done
```

- **spec** and **arch** are new pre-development phases. Never skip them.
- **design** and **backend** run in parallel after pm completes — dispatch both, wait for both.
- **CHECKPOINT A** requires explicit human approval before pm can run: `node orchestrate.js checkpoint A`
- **CHECKPOINT B** requires explicit human approval before done can run: `node orchestrate.js checkpoint B`

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

## File produced by each agent

| Agent | Must produce |
|-------|-------------|
| spec | requirements.md, use-cases.md, intent.md |
| arch | architecture-decision.md (ADR-001 in adr/) |
| pm | PLAN.md (all [TODO] fields filled) |
| design | design-spec.md, design-tokens.md |
| backend | api-spec.yaml, api-samples.sh, schema.sql |
| frontend | src/ (components, hooks, tests/), api-contract.md |
| qa | qa-report.md, e2e/stories.spec.ts |
| orchestrator | DONE.md |
