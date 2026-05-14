# agent-templates

One command to scaffold a multi-agent development project — with structured prompts for every role in the dev cycle.

```bash
node agent-init.js my-project
```

---

## What it does

Initializes a project directory with:
- A `PLAN.md` template (the single source of truth for all agents)
- A prompt file for each agent role (`/agents/`)
- `orchestrate.js` — pipeline controller with status, validate, advance, verify, run, and done commands
- `CLAUDE.md` — auto-pipeline rules for Claude Code
- A `cycle-state.json` for tracking progress

```
my-project/
├── PLAN.md
├── orchestrate.js   ← pipeline controller
├── CLAUDE.md        ← Claude Code auto-pipeline rules
├── cycle-state.json
├── .gitignore
└── agents/
    ├── agent-orchestrator.md
    ├── agent-pm.md
    ├── agent-design.md
    ├── agent-frontend.md
    ├── agent-backend.md
    └── agent-qa.md
```

---

## The dev cycle

```
User request
    │
    ▼
PM → Design → Backend → Frontend → QA → Done
```

Backend runs before Frontend because Frontend's `validate()` requires `api-spec.yaml` from Backend.

Each agent has a defined input contract (what it needs) and output contract (what it must produce). `orchestrate.js` enforces the handoff order and blocks dispatch if a required artifact is missing.

---

## Usage

**1. Run init**
```bash
node agent-init.js your-project-name
```

**2. Fill in PLAN.md**

Every `[TODO]` field. This is the only manual step — the rest flows from here.

**3. Run the automated pipeline**

```bash
cd your-project-name
node orchestrate.js run
```

`orchestrate.js run` dispatches each agent in order, polling `cycle-state.json` for completion. After each agent finishes, run:
```bash
node orchestrate.js advance <agent-name>
```

For the frontend agent, run verify first:
```bash
node orchestrate.js verify
node orchestrate.js advance frontend
```

When all agents are done:
```bash
node orchestrate.js done   # produces DONE.md
```

---

## orchestrate.js commands

| Command | What it does |
|---------|-------------|
| `status` | Show current phase, completed agents, and artifact checklist |
| `validate <agent>` | Check if all required inputs exist; print BLOCKED if not |
| `advance <agent>` | Mark agent complete, update phase, move to next |
| `verify` | Run `tsc --noEmit`, `npm run build`, `npm run test -- --run`, and Lighthouse (if dev server is up); writes `verify-report.json` |
| `run` | Automated pipeline — dispatches agents in order, polls for each `advance` |
| `done` | Generate `DONE.md` with artifact and completion summary |

---

## Agent roles

| Agent | Produces |
|-------|----------|
| `agent-pm.md` | `PLAN.md` — scope, user stories, milestones |
| `agent-design.md` | `design-spec.md`, `design-tokens.md` |
| `agent-backend.md` | `api-spec.yaml` (OpenAPI 3.0), `api-samples.sh`, `schema.sql` |
| `agent-frontend.md` | `/src` (components, hooks, tests), `api-contract.md` |
| `agent-qa.md` | `qa-report.md`, `e2e/stories.spec.ts` (Playwright) |
| `agent-orchestrator.md` | `DONE.md` |

---

## Customizing

- **Add a rule to an agent** — edit the relevant `agent-*.md` directly
- **Change the PLAN.md format** — edit `PLAN.template.md`
- **Add a new agent role** (e.g. DevOps, Security) — create `agent-devops.md` and add it to `AGENT_FILES` in `agent-init.js`

---

## Requirements

Node.js 16+. No dependencies.
