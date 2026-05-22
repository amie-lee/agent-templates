# agent-templates

One command to scaffold a multi-agent development project — with structured prompts for every role in the dev cycle.

```bash
node agent-init.js my-project
```

---

## What it does

Initializes a project directory with:
- `requirements.md` + `use-cases.md` templates — Spec Agent fills these in before any development
- A `PLAN.md` template — PM Agent fills this in after architecture is decided
- A prompt file for each agent role (`/agents/`)
- `orchestrate.js` — pipeline controller with status, validate, advance, checkpoint, verify, run, and done commands
- `CLAUDE.md` — auto-pipeline rules for Claude Code
- `adr/` — Architecture Decision Records folder
- A `cycle-state.json` for tracking progress

```
my-project/
├── requirements.md       ← Spec Agent output (requirements + use cases)
├── use-cases.md          ← Spec Agent output
├── PLAN.md               ← PM Agent output (after arch decision)
├── orchestrate.js        ← pipeline controller
├── CLAUDE.md             ← Claude Code auto-pipeline rules
├── cycle-state.json
├── .gitignore
├── adr/
│   ├── ADR-000-index.md
│   └── ADR-001-architecture.md  ← Architecture Agent output
└── agents/
    ├── agent-orchestrator.md
    ├── agent-spec.md       ← NEW
    ├── agent-arch.md       ← NEW
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
Spec → Arch → [CHECKPOINT A: human approves] → PM → Design∥Backend → Frontend → QA → [CHECKPOINT B: human approves] → Done
```

- **Spec** extracts requirements, use cases, and project intent before any planning
- **Arch** picks the architecture and records the decision (ADR-001) before any planning
- **CHECKPOINT A** is a hard stop — human reviews scope and architecture before development begins
- **Design and Backend run in parallel** — both depend only on PLAN.md
- **CHECKPOINT B** is a hard stop — human reviews the sprint result before shipping

Each agent has a defined input contract (what it needs) and output contract (what it must produce). `orchestrate.js` enforces the handoff order and blocks dispatch if a required artifact is missing.

---

## Usage

**1. Run init**
```bash
node agent-init.js your-project-name
```

**2. Run the Spec Agent**

Hand `agents/agent-spec.md` to Claude with your project idea. It will ask clarifying questions and produce:
- `requirements.md` — structured functional + non-functional requirements
- `use-cases.md` — actor map and use case flows
- `intent.md` — project type, scale, quality priorities

**3. Run the Architecture Agent**

Hand `agents/agent-arch.md` to Claude with `requirements.md` + `intent.md`. It will produce:
- `architecture-decision.md` (ADR-001) — chosen architecture + tech stack

**4. CHECKPOINT A — human review**

Review `requirements.md` and `architecture-decision.md`. When approved:
```bash
node orchestrate.js checkpoint A
```

**5. Run the automated pipeline**

```bash
cd your-project-name
node orchestrate.js run
```

After each agent finishes, run:
```bash
node orchestrate.js advance <agent-name>
```

For the frontend agent, run verify first:
```bash
node orchestrate.js verify
node orchestrate.js advance frontend
```

**6. CHECKPOINT B — sprint review**

Review `qa-report.md`. When approved:
```bash
node orchestrate.js checkpoint B
node orchestrate.js done   # produces DONE.md
```

---

## orchestrate.js commands

| Command | What it does |
|---------|-------------|
| `status` | Show current phase, checkpoints, completed agents, and artifact checklist |
| `validate <agent>` | Check if all required inputs exist; print BLOCKED if not |
| `advance <agent>` | Mark agent complete, update phase, move to next |
| `checkpoint <A\|B>` | Record human approval at a pipeline checkpoint |
| `verify` | Run `tsc --noEmit`, `npm run build`, `npm run test -- --run`, and Lighthouse; writes `verify-report.json` |
| `run` | Automated pipeline — dispatches agents in order, polls for each `advance` |
| `done` | Generate `DONE.md` with artifact and completion summary |

---

## Agent roles

| Agent | Phase | Produces |
|-------|-------|----------|
| `agent-spec.md` | Pre-dev | `requirements.md`, `use-cases.md`, `intent.md` |
| `agent-arch.md` | Pre-dev | `architecture-decision.md` (ADR-001) |
| `agent-pm.md` | Planning | `PLAN.md` — scope, user stories, milestones |
| `agent-design.md` | Dev (parallel) | `design-spec.md`, `design-tokens.md` |
| `agent-backend.md` | Dev (parallel) | `api-spec.yaml` (OpenAPI 3.0), `api-samples.sh`, `schema.sql` |
| `agent-frontend.md` | Dev | `/src` (components, hooks, tests), `api-contract.md` |
| `agent-qa.md` | QA | `qa-report.md`, `e2e/stories.spec.ts` (Playwright) |
| `agent-orchestrator.md` | Done | `DONE.md` |

---

## Customizing

- **Add a rule to an agent** — edit the relevant `agent-*.md` directly
- **Change the PLAN.md format** — edit `PLAN.template.md`
- **Add a new agent role** (e.g. DevOps, Security) — create `agent-devops.md` and add it to `AGENT_FILES` in `agent-init.js`

---

## Requirements

Node.js 16+. No dependencies.
