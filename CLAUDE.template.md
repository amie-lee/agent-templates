# CLAUDE.md — Auto-pipeline rules

This file configures how Claude Code behaves in this project.

---

## Auto-pipeline rule

On session start in this project root:

1. Run `node orchestrate.js status` and read the output
2. If a file named `.current-agent` exists in the project root, immediately execute that agent's prompt from `agents/`
3. After every agent completes its work, always run `node orchestrate.js advance <agent-name>`
4. If `advance` does not report BLOCKED, automatically proceed to the next pending agent
5. Never ask the user for confirmation between steps — only pause when a BLOCKED output is emitted

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
pm → design → backend → frontend → qa → done
```

Backend runs before Frontend because Frontend's `validate()` requires `api-spec.yaml`.

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
| pm | PLAN.md (all [TODO] fields filled) |
| design | design-spec.md, design-tokens.md |
| backend | api-spec.yaml, api-samples.sh, backend-contract.test.ts, schema.sql |
| frontend | src/ (components, hooks, tests/), api-contract.md |
| qa | qa-report.md, e2e/stories.spec.ts |
| orchestrator | DONE.md |
