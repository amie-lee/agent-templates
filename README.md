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
- A `cycle-state.json` for the Orchestrator to track progress

```
my-project/
├── PLAN.md
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
Orchestrator → PM → Design → Frontend + Backend (parallel) → QA → Done
```

Each agent has a defined input contract (what it needs) and output contract (what it must produce). The Orchestrator enforces the handoff order and blocks dispatch if a required artifact is missing.

---

## Usage

**1. Run init**
```bash
node agent-init.js your-project-name
```

**2. Fill in PLAN.md**

Every `[TODO]` field. This is the only manual step — the rest flows from here.

**3. Start the cycle**

Pass these two files to your AI agent runner of choice:
```
agents/agent-orchestrator.md
PLAN.md
```

Prompt to start:
```
Read cycle-state.json and agents/agent-orchestrator.md.
The project is in phase: init. What should happen next?
```

---

## Agent roles

| Agent | Produces |
|-------|----------|
| `agent-pm.md` | `PLAN.md` — scope, user stories, milestones |
| `agent-design.md` | `design-spec.md`, `design-tokens.md` |
| `agent-frontend.md` | `/src` components, `api-contract.md` |
| `agent-backend.md` | `/src` routes + services, `schema.sql` |
| `agent-qa.md` | `qa-report.md` — test results, bug reports |
| `agent-orchestrator.md` | `cycle-state.json`, `DONE.md` |

---

## Customizing

- **Add a rule to an agent** — edit the relevant `agent-*.md` directly
- **Change the PLAN.md format** — edit `PLAN.template.md`
- **Add a new agent role** (e.g. DevOps, Security) — create `agent-devops.md` and add it to the `AGENT_FILES` array in `agent-init.js`

---

## Requirements

Node.js 16+. No dependencies.