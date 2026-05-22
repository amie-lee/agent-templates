# agent-templates

A scaffolding system for running a structured team of AI agents that plans, designs, builds, and tests software — sprint by sprint, with a human in the loop at every critical decision.

```bash
node agent-init.js my-project
```

---

## The idea

Instead of asking an AI to "build me an app", you give it a team:

- A **Spec Agent** that interviews you and writes requirements
- An **Architecture Agent** that picks the right system design for your goals
- A **PM Agent** that scopes each sprint and manages the backlog
- A **Design Agent** that specifies every screen and component
- A **Backend Agent** that builds the API and database
- A **Frontend Agent** that builds the UI
- A **QA Agent** that plans tests before a line of code exists — and runs them after
- An **Orchestrator** that runs meetings, enforces handoffs, and keeps everyone on track

Each agent has a defined job, defined inputs, and defined outputs. They hold meetings. They write ADRs when they make significant decisions. They can't expand scope mid-sprint. And you — the human — approve the work at two key checkpoints before anything ships.

---

## The workflow

```
Your request
    │
    ▼
[Spec Agent]
  Writes intake.md — pastes your request verbatim, writes its interpretation,
  asks clarifying questions, waits for your confirmation before proceeding.
  Then produces: requirements.md, use-cases.md, intent.md
    │
    ▼
[Architecture Agent]
  Reads your intent. Evaluates 2–3 architectural options.
  Picks one and documents why in ADR-001 (architecture-decision.md).
  Maps each intent dimension → architectural consequence explicitly.
    │
    ▼
★ CHECKPOINT A — You review scope and architecture.
  Read: requirements.md + architecture-decision.md
  Approve: node orchestrate.js checkpoint A
    │
    ▼
[PM Agent]
  Selects stories for this sprint (max 5–8).
  Everything else goes to sprint-backlog.md with a reason.
  Produces: PLAN.md, sprint-N-plan.md, sprint-backlog.md
    │
    ▼
[KICKOFF MEETING]
  All agents review PLAN.md. Surface risks and testability concerns.
  QA raises issues with acceptance criteria before any code is written.
  node orchestrate.js meeting start kickoff
    │
    ├─────────────────────────────────────────┐──────────────────┐
    ▼                                         ▼                  ▼
[Design Agent]                         [Backend Agent]    [QA Agent — Planning]
Specifies every screen, component,     Builds API and     Writes test plan and
state, and interaction.                database schema.   E2E test skeletons from
design-spec.md, design-tokens.md       api-spec.yaml,     requirements — before
                                       schema.sql         any code exists.
    └─────────────────────────────────────────┘──────────────────┘
    ▼
[CROSS-REVIEW MEETING]
  Design reviews the API. Backend reviews the UI spec.
  Mismatches resolved before Frontend starts.
  node orchestrate.js meeting start cross-review
    │
    ▼
[Frontend Agent]
  Reads the cross-review decisions before writing a line.
  Builds UI to the resolved spec — no scope expansion.
  Produces: /src/, api-contract.md
    │
    ▼
[node orchestrate.js verify]
  Runs typecheck, build, tests → verify-report.json
    │
    ▼
[QA Agent — Run]
  Fills in the E2E test skeletons with real assertions.
  Runs everything against the live app.
  Files bugs. Produces: qa-report.md
    │
    ▼
[SPRINT REVIEW MEETING]
  All agents report status and sign off (or raise blockers).
  node orchestrate.js meeting start sprint-review
    │
    ▼
★ CHECKPOINT B — You review the sprint result.
  Read: qa-report.md + sprint-review meeting
  Decision: ship / fix / next sprint
  Approve: node orchestrate.js checkpoint B
    │
    ▼
DONE.md  (or)  node orchestrate.js sprint next → Sprint N+1
```

---

## Quick start

```bash
# 1. Scaffold a new project
node agent-init.js my-project
cd my-project

# 2. Run the Spec Agent
#    Hand agents/agent-spec.md to Claude with your project idea.
#    It will interview you, write intake.md, then requirements.md etc.

# 3. Check project status at any time
node orchestrate.js report

# 4. Step through the pipeline
node orchestrate.js status
node orchestrate.js validate <agent>
node orchestrate.js advance <agent>

# 5. Manage sprints
node orchestrate.js sprint status
node orchestrate.js sprint next      # start next sprint

# 6. Run meetings
node orchestrate.js meeting start kickoff
node orchestrate.js meeting start cross-review
node orchestrate.js meeting start sprint-review

# 7. Approve checkpoints
node orchestrate.js checkpoint A     # after architecture
node orchestrate.js checkpoint B     # after QA

# 8. View all decisions
node orchestrate.js adr
```

---

## Project structure

After `node agent-init.js my-project`:

```
my-project/
│
├── intake.md                ← Your request (verbatim) + agent interpretation + Q&A
├── requirements.md          ← Structured requirements (FR, NFR, MoSCoW priorities)
├── use-cases.md             ← Actor map + use case flows
├── intent.md                ← Project type, scale, quality priorities
│
├── PLAN.md                  ← Current sprint scope (what agents build NOW)
├── sprint-backlog.md        ← Everything deferred + mid-sprint discoveries
│
├── design-spec.md           ← Screen-by-screen UI spec
├── design-tokens.md         ← Colors, spacing, typography
├── api-spec.yaml            ← OpenAPI 3.0 contract
├── api-contract.md          ← Frontend's view of the API
├── schema.sql               ← Database schema
├── qa-plan.md               ← Test strategy + test cases (written before code)
├── verify-report.json       ← Build + typecheck + test results
├── qa-report.md             ← Full QA report with bugs
├── REPORT.md                ← Human-readable status (from `orchestrate.js report`)
├── DONE.md                  ← Sprint completion summary
│
├── adr/
│   ├── ADR-000-index.md     ← All decisions, one table
│   ├── adr.template.md      ← Template for new ADRs
│   └── ADR-001-*.md         ← Architecture decision (+ more from each agent)
│
├── meetings/
│   ├── meeting.template.md
│   ├── sprint-01-kickoff.md
│   ├── sprint-01-cross-review.md
│   └── sprint-01-review.md
│
├── orchestrate.js           ← Pipeline controller
├── CLAUDE.md                ← Rules for Claude Code auto-pipeline
├── cycle-state.json         ← Machine-readable project state
├── .gitignore
│
└── agents/
    ├── agent-orchestrator.md
    ├── agent-spec.md
    ├── agent-arch.md
    ├── agent-pm.md
    ├── agent-design.md
    ├── agent-backend.md
    ├── agent-frontend.md
    └── agent-qa.md
```

---

## The team

| Agent | When | Produces | Key rule |
|-------|------|---------|----------|
| **Spec** | First | `intake.md`, `requirements.md`, `use-cases.md`, `intent.md` | Confirms interpretation before writing requirements |
| **Architecture** | After Spec | `architecture-decision.md` (ADR-001) | Must evaluate ≥2 options; maps intent → architecture explicitly |
| **PM** | After CHECKPOINT A | `PLAN.md`, `sprint-N-plan.md`, `sprint-backlog.md` | Max 5–8 stories per sprint; everything else goes to backlog |
| **Design** | Sprint, parallel | `design-spec.md`, `design-tokens.md` | Every component has 4 states; deviations → ADR |
| **Backend** | Sprint, parallel | `api-spec.yaml`, `schema.sql`, `api-samples.sh` | API contract deviations → mandatory ADR |
| **QA (Planning)** | Sprint, parallel | `qa-plan.md`, `e2e/stories.spec.ts` (skeleton) | Writes tests before code exists |
| **Frontend** | After cross-review | `/src/`, `api-contract.md` | Reads cross-review decisions first; no silent scope expansion |
| **QA (Run)** | After Frontend | `qa-report.md`, `e2e/stories.spec.ts` (complete) | Waived contract violations → mandatory ADR |
| **Orchestrator** | Always | Meetings, `DONE.md` | Facilitates meetings; escalates to human when agents disagree |

---

## Decision trail

Every significant decision made by any agent is recorded in `adr/` as an Architecture Decision Record.

```bash
node orchestrate.js adr          # list all decisions
```

Each ADR captures: what situation forced the decision, what was decided, what alternatives were considered, the rationale, and the consequences — including what downstream agents must do differently because of it.

ADRs are never edited after the fact. If a decision changes, a new ADR is written that supersedes the old one.

---

## Meetings

Three meetings gate sprint progress. Each is a markdown file in `meetings/` — agents write their sections independently, the Orchestrator resolves conflicts and closes the meeting.

| Meeting | Triggered by | Blocks | Command |
|---------|-------------|--------|---------|
| **Kickoff** | PM completes PLAN.md | Design + Backend + QA-Planning cannot start | `meeting start kickoff` |
| **Cross-review** | Design + Backend both complete | Frontend cannot start | `meeting start cross-review` |
| **Sprint Review** | QA Run completes | CHECKPOINT B cannot run | `meeting start sprint-review` |

If a meeting has unresolved blockers that agents cannot settle, it becomes **ESCALATED** — the pipeline pauses and you decide.

---

## Sprint discipline

Sprints have hard boundaries. Once a sprint starts (after Kickoff meeting), no new stories can be added. Every agent follows one rule:

> **If it's not in PLAN.md, don't build it. Log it to sprint-backlog.md and keep going.**

Mid-sprint discoveries go to `sprint-backlog.md` under "Discovered Mid-Sprint" and are reviewed at the Sprint Review meeting. Only a blocker (something that prevents a planned story from completing) can pause the pipeline — and even then it requires Orchestrator or human resolution, not silent scope expansion.

```bash
node orchestrate.js sprint status         # current sprint progress
node orchestrate.js sprint backlog        # see deferred + discovered items
node orchestrate.js sprint next           # close sprint, start the next one
```

---

## Commands

### Every day
```bash
node orchestrate.js report                # human-readable project status
node orchestrate.js status                # technical pipeline state
```

### Pipeline
```bash
node orchestrate.js validate <agent>      # check if agent can start
node orchestrate.js advance <agent>       # mark agent complete
node orchestrate.js verify                # run build + typecheck + tests
node orchestrate.js done                  # produce DONE.md
```

### Human approvals
```bash
node orchestrate.js checkpoint A          # approve scope + architecture
node orchestrate.js checkpoint B          # approve sprint result
```

### Sprint management
```bash
node orchestrate.js sprint status
node orchestrate.js sprint set-goal "Your sprint goal"
node orchestrate.js sprint set-capacity 5
node orchestrate.js sprint complete-story
node orchestrate.js sprint next
node orchestrate.js sprint backlog
```

### Meetings
```bash
node orchestrate.js meeting               # list all meetings
node orchestrate.js meeting start kickoff
node orchestrate.js meeting start cross-review
node orchestrate.js meeting start sprint-review
node orchestrate.js meeting close sprint-01-kickoff.md
```

### Decisions
```bash
node orchestrate.js adr                   # list all ADRs
```

---

## Customizing

- **Add a rule to an agent** — edit the relevant `agents/agent-*.md` directly
- **Change sprint capacity** — edit the default in `agent-pm.md` Behavioral Rules
- **Add a new agent** (e.g., DevOps, Security) — create `agents/agent-devops.md` and add it to `AGENT_FILES` in `agent-init.js`
- **Change the requirements format** — edit `requirements.template.md`
- **Change the ADR format** — edit `adr.template.md`

---

## Requirements

Node.js 16+. No dependencies.
