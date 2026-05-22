#!/usr/bin/env node
/**
 * orchestrate.js
 * Pipeline controller for agent-driven development projects.
 * Usage: node orchestrate.js <command> [arg]
 *
 * Commands:
 *   status                  — show current cycle-state.json
 *   validate <agent>        — check if agent's required inputs exist
 *   advance <agent>         — mark agent complete, update state
 *   checkpoint <A|B>        — record human approval at a checkpoint
 *   verify                  — run typecheck, build, test, lighthouse
 *   run                     — automated pipeline (polls for each advance)
 *   done                    — produce DONE.md
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Agent contracts ──────────────────────────────────────────────────────────
// Pipeline: spec → arch → [CHECKPOINT A] → pm → design∥backend → frontend → qa → [CHECKPOINT B]
// Design and Backend run in parallel — both depend only on PLAN.md.

const AGENT_CONTRACTS = {
  spec: {
    requires: [],  // first agent — only needs user input (natural language, no files)
    produces: ['intake.md', 'requirements.md', 'use-cases.md', 'intent.md'],
  },
  arch: {
    requires: ['intake.md', 'requirements.md', 'intent.md'],
    produces: ['architecture-decision.md'],
    beforeCheckpoint: 'A',  // CHECKPOINT A happens after arch completes
  },
  pm: {
    requires: ['requirements.md', 'use-cases.md', 'architecture-decision.md'],
    produces: ['PLAN.md'],
    afterCheckpoint: 'A',   // PM can only run after CHECKPOINT A is approved
  },
  design: {
    requires: ['PLAN.md'],
    produces: ['design-spec.md', 'design-tokens.md'],
    parallel: 'backend',    // runs simultaneously with backend
  },
  backend: {
    requires: ['PLAN.md'],
    produces: ['api-spec.yaml', 'api-samples.sh', 'schema.sql'],
    parallel: 'design',     // runs simultaneously with design
  },
  frontend: {
    requires: ['PLAN.md', 'design-spec.md', 'api-spec.yaml'],
    produces: ['verify-report.json', 'src/tests/'],
  },
  'qa-planning': {
    requires: ['PLAN.md', 'requirements.md'],
    produces: ['qa-plan.md', 'e2e/stories.spec.ts'],
    parallel: ['design', 'backend'],  // runs simultaneously with design and backend
  },
  'qa-run': {
    requires: ['PLAN.md', 'qa-plan.md', 'api-spec.yaml', 'verify-report.json'],
    produces: ['qa-report.md'],
    beforeCheckpoint: 'B',  // CHECKPOINT B happens after qa-run completes
  },
};

// Meeting state helpers
const MEETING_DIR = 'meetings';
const MEETING_TYPES = {
  kickoff: { trigger: 'PLAN.md completed', attendees: ['spec', 'arch', 'pm', 'design', 'backend', 'qa-planning'] },
  'cross-review': { trigger: 'Design + Backend completed', attendees: ['design', 'backend', 'frontend'] },
  'sprint-review': { trigger: 'QA Run completed', attendees: ['design', 'backend', 'frontend', 'qa-run'] },
};

// Linear pipeline for sequential dispatch (parallel steps handled separately)
const AGENT_PIPELINE = ['spec', 'arch', 'pm', 'design', 'backend', 'qa-planning', 'frontend', 'qa-run'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readState() {
  const p = path.join(process.cwd(), 'cycle-state.json');
  if (!fs.existsSync(p)) {
    console.error('cycle-state.json not found. Are you in the project root?');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeState(state) {
  fs.writeFileSync(
    path.join(process.cwd(), 'cycle-state.json'),
    JSON.stringify(state, null, 2)
  );
}

function fileExists(name) {
  return fs.existsSync(path.join(process.cwd(), name));
}

function run(cmd) {
  try {
    const stdout = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { success: true, output: stdout };
  } catch (err) {
    return { success: false, output: err.stderr || err.message };
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

function cmd_status() {
  const state = readState();

  const sprintNum = state.sprint || 1;
  const goal = state.sprintGoal || '(not set)';
  console.log(`\n━━━ Sprint ${sprintNum} ━━━`);
  console.log(`Goal:      ${goal}`);
  if (state.sprintStoriesPlanned) {
    const done = state.sprintStoriesCompleted || 0;
    const planned = state.sprintStoriesPlanned;
    const bar = '█'.repeat(done) + '░'.repeat(Math.max(0, planned - done));
    console.log(`Progress:  [${bar}] ${done}/${planned} stories`);
  }
  console.log(`Phase:     ${state.phase}`);
  console.log(`Completed: ${state.completed.join(', ') || 'none'}`);
  console.log(`Pending:   ${state.pending.join(', ') || 'none'}`);
  if (state.blockers && state.blockers.length) {
    console.log(`Blockers:  ${state.blockers.join(', ')}`);
  }

  const checkpoints = state.checkpoints || {};
  console.log('\nCheckpoints:');
  console.log(`  ${checkpoints.A === 'approved' ? '✓' : '○'} CHECKPOINT A — Scope + Architecture approval`);
  console.log(`  ${checkpoints.B === 'approved' ? '✓' : '○'} CHECKPOINT B — Sprint review`);

  const meetings = state.meetings || {};
  console.log('\nMeetings:');
  console.log(`  ${meetings.kickoff === 'resolved' ? '✓' : '○'} Kickoff`);
  console.log(`  ${meetings['cross-review'] === 'resolved' ? '✓' : '○'} Cross-review`);
  console.log(`  ${meetings['sprint-review'] === 'resolved' ? '✓' : '○'} Sprint Review`);

  console.log('\nArtifacts:');
  for (const [artifact, recorded] of Object.entries(state.artifacts || {})) {
    const exists = fileExists(artifact);
    const marker = exists ? '✓' : '✗';
    const mismatch = recorded !== exists ? ' ⚠ mismatch' : '';
    console.log(`  ${marker} ${artifact}${mismatch}`);
  }
  console.log('');
}

function cmd_validate(agent) {
  if (!agent) {
    console.error('Usage: node orchestrate.js validate <agent>');
    console.error(`Valid agents: ${Object.keys(AGENT_CONTRACTS).join(', ')}`);
    process.exit(1);
  }

  const contract = AGENT_CONTRACTS[agent];
  if (!contract) {
    console.error(`Unknown agent: ${agent}`);
    console.error(`Valid agents: ${Object.keys(AGENT_CONTRACTS).join(', ')}`);
    process.exit(1);
  }

  // spec agent has no file prerequisites
  if (agent === 'spec') {
    console.log('✓ spec has no file prerequisites — ready to run');
    process.exit(0);
  }

  // Check if a required checkpoint must be approved first
  if (contract.afterCheckpoint) {
    const state = readState();
    const cpStatus = (state.checkpoints || {})[contract.afterCheckpoint];
    if (cpStatus !== 'approved') {
      console.log('PIPELINE STOPPED');
      console.log(`Agent: ${agent}`);
      console.log(`Waiting on: CHECKPOINT ${contract.afterCheckpoint} — human approval required`);
      console.log(`Action needed: Review outputs, then run: node orchestrate.js checkpoint ${contract.afterCheckpoint}`);
      process.exit(1);
    }
  }

  const missing = contract.requires.filter(f => !fileExists(f));

  if (missing.length === 0) {
    console.log(`✓ ${agent} is ready to run`);
    if (contract.requires.length > 0) {
      console.log(`  Requires: ${contract.requires.join(', ')}`);
    }
    if (contract.parallel) {
      console.log(`  ↔ Runs in parallel with: ${contract.parallel}`);
    }
    process.exit(0);
  } else {
    console.log('PIPELINE STOPPED');
    console.log(`Agent: ${agent}`);
    console.log(`Missing: ${missing.join(', ')}`);
    console.log(`Action needed: Create or fill in the missing files listed above`);
    process.exit(1);
  }
}

function cmd_checkpoint(label) {
  if (!label || !['A', 'B'].includes(label.toUpperCase())) {
    console.error('Usage: node orchestrate.js checkpoint <A|B>');
    console.error('  A — approve scope + architecture (before PM agent)');
    console.error('  B — approve sprint result (before DONE)');
    process.exit(1);
  }
  const cp = label.toUpperCase();
  const state = readState();
  state.checkpoints = state.checkpoints || {};
  state.checkpoints[cp] = 'approved';
  writeState(state);

  const descriptions = {
    A: 'Scope + architecture approved. PM Agent may now run.',
    B: 'Sprint result approved. Ready to produce DONE.md.',
  };
  console.log(`✓ CHECKPOINT ${cp} approved — ${descriptions[cp]}`);
  if (cp === 'A') {
    console.log('  Next: node orchestrate.js validate pm');
  } else if (cp === 'B') {
    console.log('  Next: node orchestrate.js done');
  }
}

function cmd_advance(agent) {
  if (!agent) {
    console.error('Usage: node orchestrate.js advance <agent>');
    process.exit(1);
  }

  const state = readState();
  const contract = AGENT_CONTRACTS[agent];

  // Warn if expected produces are missing
  if (contract) {
    const missingProduced = contract.produces.filter(f => {
      if (f.endsWith('/')) {
        return !fs.existsSync(path.join(process.cwd(), f));
      }
      return !fileExists(f);
    });
    if (missingProduced.length > 0) {
      console.warn(`⚠ Warning: ${agent} marked complete but expected outputs are missing:`);
      missingProduced.forEach(f => console.warn(`  - ${f}`));
    }
  }

  // Update completed / pending
  if (!state.completed.includes(agent)) {
    state.completed.push(agent);
  }
  state.pending = (state.pending || []).filter(a => a !== agent);

  // Advance phase to next pipeline agent
  const idx = AGENT_PIPELINE.indexOf(agent);
  if (idx >= 0 && idx < AGENT_PIPELINE.length - 1) {
    const next = AGENT_PIPELINE[idx + 1];
    if (!state.completed.includes(next) && !(state.pending || []).includes(next)) {
      state.pending = state.pending || [];
      state.pending.push(next);
    }
    state.phase = next;
  } else if (idx === AGENT_PIPELINE.length - 1) {
    state.phase = 'done';
  }

  // Update artifacts map
  if (contract) {
    state.artifacts = state.artifacts || {};
    for (const f of contract.produces) {
      if (!f.endsWith('/')) {
        state.artifacts[f] = fileExists(f);
      }
    }
  }

  writeState(state);
  console.log(`✓ ${agent} marked complete. Phase: ${state.phase}`);
  if (state.pending && state.pending.length) {
    console.log(`  Next: ${state.pending[0]}`);
  }
}

function cmd_verify() {
  console.log('Running verification suite...\n');

  const report = {
    timestamp: new Date().toISOString(),
    typecheck: null,
    build: null,
    test: null,
    lighthouse: null,
  };

  console.log('  typecheck...');
  report.typecheck = run('npx tsc --noEmit');
  console.log(report.typecheck.success ? '  ✓ typecheck' : '  ✗ typecheck');

  console.log('  build...');
  report.build = run('npm run build');
  console.log(report.build.success ? '  ✓ build' : '  ✗ build');

  console.log('  test...');
  report.test = run('npm run test -- --run');
  console.log(report.test.success ? '  ✓ test' : '  ✗ test');

  // Lighthouse: only if dev server is reachable
  console.log('  lighthouse...');
  const serverCheck = run('curl -s -o /dev/null -w "%{http_code}" http://localhost:5173');
  if (serverCheck.success && serverCheck.output.trim() === '200') {
    report.lighthouse = run(
      'npx lighthouse http://localhost:5173 --output=json --output-path=./lighthouse-report.json --chrome-flags="--headless"'
    );
    console.log(report.lighthouse.success ? '  ✓ lighthouse' : '  ✗ lighthouse');
  } else {
    report.lighthouse = { skipped: true, reason: 'dev server not running on localhost:5173' };
    console.log('  ⚠ lighthouse skipped — start dev server first');
  }

  fs.writeFileSync('verify-report.json', JSON.stringify(report, null, 2));

  const checks = [report.typecheck, report.build, report.test];
  const passed = checks.filter(r => r && r.success).length;
  const skippedLH = report.lighthouse && report.lighthouse.skipped;

  console.log(`\nVerify complete: ${passed}/3 checks passed${skippedLH ? ' (lighthouse skipped)' : ''}`);
  console.log('Written: verify-report.json');

  const allPassed = checks.every(r => r && r.success);
  process.exit(allPassed ? 0 : 1);
}

function cmd_run() {
  console.log('Starting automated pipeline...');
  console.log('Pipeline prints instructions at each step, then polls for advance.\n');

  function pollUntilAdvanced(agentName, callback) {
    const interval = setInterval(() => {
      const state = readState();
      if (state.completed.includes(agentName)) {
        clearInterval(interval);
        const markerPath = path.join(process.cwd(), '.current-agent');
        if (fs.existsSync(markerPath)) fs.unlinkSync(markerPath);
        callback();
      }
    }, 500);
  }

  function runNextAgent() {
    const state = readState();

    if (state.phase === 'done' || !state.pending || state.pending.length === 0) {
      console.log('\n✓ Pipeline complete. Run: node orchestrate.js done');
      return;
    }

    const agent = state.pending[0];
    const contract = AGENT_CONTRACTS[agent];

    // Validate inputs before dispatching
    if (contract) {
      const missing = contract.requires.filter(f => !fileExists(f));
      if (missing.length > 0) {
        console.log('\nPIPELINE STOPPED');
        console.log(`Agent: ${agent}`);
        console.log(`Missing: ${missing.join(', ')}`);
        console.log(`Action needed: Create the missing files, then re-run: node orchestrate.js run`);
        process.exit(1);
      }
    }

    // Write .current-agent marker for CLAUDE.md auto-pickup
    fs.writeFileSync(path.join(process.cwd(), '.current-agent'), agent);

    console.log(`\nDISPATCH: ${agent}`);
    console.log(`→ Read agents/agent-${agent}.md and execute.`);
    if (agent === 'frontend') {
      console.log(`→ After completion, run: node orchestrate.js verify`);
      console.log(`  Then run: node orchestrate.js advance ${agent}`);
    } else {
      console.log(`→ After completion, run: node orchestrate.js advance ${agent}`);
    }
    console.log('  (polling for advance...)\n');

    pollUntilAdvanced(agent, runNextAgent);
  }

  runNextAgent();
}

function cmd_report() {
  const state = readState();
  const date = new Date().toISOString().split('T')[0];
  const projectName = state.projectName || 'Project';
  const sprint = state.sprint || 1;
  const lines = [];

  const hr = '━'.repeat(52);
  lines.push('');
  lines.push(hr);
  lines.push(`  PROJECT STATUS REPORT — ${projectName}`);
  lines.push(`  Generated: ${date}   Sprint: ${sprint}`);
  lines.push(hr);

  // ── Sprint state ──────────────────────────────────────
  lines.push('');
  lines.push('SPRINT');
  const goal = state.sprintGoal;
  if (goal) {
    lines.push(`  Goal: "${goal}"`);
  } else {
    lines.push('  Goal: (not set — PM agent has not run for this sprint)');
  }
  const planned = state.sprintStoriesPlanned || 0;
  const done = state.sprintStoriesCompleted || 0;
  if (planned > 0) {
    const pct = Math.round((done / planned) * 100);
    const filled = Math.round((done / planned) * 20);
    const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
    lines.push(`  Progress: [${bar}] ${done}/${planned} stories (${pct}%)`);
  } else {
    lines.push('  Progress: No stories planned yet');
  }

  // ── What's done ───────────────────────────────────────
  lines.push('');
  lines.push('WHAT\'S DONE');
  const artifacts = state.artifacts || {};
  const agentLabels = {
    'intake.md':              'Requirements intake captured (intake.md)',
    'requirements.md':        'Requirements written (requirements.md)',
    'use-cases.md':           'Use cases defined (use-cases.md)',
    'intent.md':              'Project intent documented (intent.md)',
    'architecture-decision.md': 'Architecture decided (ADR-001)',
    'PLAN.md':                `Sprint ${sprint} scope planned (PLAN.md)`,
    'sprint-backlog.md':      'Product backlog initialized (sprint-backlog.md)',
    'qa-plan.md':             'QA test plan written (qa-plan.md)',
    'design-spec.md':         'UI design complete (design-spec.md)',
    'api-spec.yaml':          'API designed (api-spec.yaml)',
    'api-contract.md':        'API contract confirmed (api-contract.md)',
    'verify-report.json':     'Build + tests verified (verify-report.json)',
    'qa-report.md':           'QA report complete (qa-report.md)',
  };
  let anyDone = false;
  for (const [file, label] of Object.entries(agentLabels)) {
    if (fileExists(file)) {
      lines.push(`  ✓ ${label}`);
      anyDone = true;
    }
  }
  if (!anyDone) lines.push('  (nothing completed yet)');

  // Meetings
  const meetings = state.meetings || {};
  if (meetings.kickoff === 'resolved')       lines.push('  ✓ Kickoff meeting held');
  if (meetings['cross-review'] === 'resolved') lines.push('  ✓ Cross-review meeting held — Design & Backend aligned');
  if (meetings['sprint-review'] === 'resolved') lines.push('  ✓ Sprint review meeting held');

  // Checkpoints
  const checkpoints = state.checkpoints || {};
  if (checkpoints.A === 'approved') lines.push('  ✓ CHECKPOINT A passed — scope & architecture approved');
  if (checkpoints.B === 'approved') lines.push('  ✓ CHECKPOINT B passed — sprint result approved');

  // ── What's in progress ───────────────────────────────
  lines.push('');
  lines.push('IN PROGRESS');
  const pending = state.pending || [];
  if (pending.length > 0) {
    const agentNames = {
      spec: 'Spec Agent — capturing requirements',
      arch: 'Architecture Agent — deciding system design',
      pm:   'PM Agent — planning sprint scope',
      design: 'Design Agent — creating UI specifications',
      backend: 'Backend Agent — building API & database',
      'qa-planning': 'QA Agent — writing test plan',
      frontend: 'Frontend Agent — building UI',
      'qa-run': 'QA Agent — running tests against the app',
    };
    for (const a of pending) {
      lines.push(`  → ${agentNames[a] || a}`);
    }
  } else if (state.phase === 'done') {
    lines.push('  Sprint complete.');
  } else {
    lines.push('  (pipeline not yet started)');
  }

  // ── Meetings pending ──────────────────────────────────
  const meetingsPending = [];
  if (meetings.kickoff !== 'resolved' && state.completed.includes('pm')) {
    meetingsPending.push('Kickoff meeting — run: node orchestrate.js meeting start kickoff');
  }
  if (meetings['cross-review'] !== 'resolved' && state.completed.includes('backend') && state.completed.includes('design')) {
    meetingsPending.push('Cross-review meeting — run: node orchestrate.js meeting start cross-review');
  }
  if (meetings['sprint-review'] !== 'resolved' && state.completed.includes('qa-run')) {
    meetingsPending.push('Sprint review meeting — run: node orchestrate.js meeting start sprint-review');
  }
  if (meetingsPending.length > 0) {
    lines.push('');
    lines.push('MEETINGS NEEDED');
    for (const m of meetingsPending) lines.push(`  ⚑ ${m}`);
  }

  // ── ADRs ──────────────────────────────────────────────
  const adrDir = path.join(process.cwd(), 'adr');
  if (fs.existsSync(adrDir)) {
    const adrFiles = fs.readdirSync(adrDir).filter(f => f.endsWith('.md') && f !== 'ADR-000-index.md');
    if (adrFiles.length > 0) {
      lines.push('');
      lines.push(`DECISIONS RECORDED (${adrFiles.length} ADRs)`);
      for (const f of adrFiles.sort()) {
        const content = fs.readFileSync(path.join(adrDir, f), 'utf8');
        const titleLine = content.split('\n').find(l => l.startsWith('# ADR-'));
        const authorLine = content.split('\n').find(l => l.includes('**Author:**'));
        const title = titleLine ? titleLine.replace(/^#\s*/, '') : f;
        const author = authorLine ? authorLine.replace(/.*\*\*Author:\*\*\s*/, '').trim() : '';
        lines.push(`  · ${title}${author ? ' — ' + author : ''}`);
      }
    }
  }

  // ── Backlog ───────────────────────────────────────────
  const backlogPath = path.join(process.cwd(), 'sprint-backlog.md');
  if (fs.existsSync(backlogPath)) {
    const backlogContent = fs.readFileSync(backlogPath, 'utf8');
    const midSprintCount = (backlogContent.match(/\| \d{4}-\d{2}-\d{2}/g) || []).length;
    lines.push('');
    lines.push('BACKLOG');
    lines.push('  sprint-backlog.md exists — open to see deferred items and discoveries');
    if (midSprintCount > 0) {
      lines.push(`  ⚑ ${midSprintCount} item(s) discovered mid-sprint — review at Sprint Review meeting`);
    }
  }

  // ── Blockers ──────────────────────────────────────────
  const blockers = state.blockers || [];
  lines.push('');
  lines.push('BLOCKERS');
  if (blockers.length > 0) {
    for (const b of blockers) lines.push(`  ⚠ ${b}`);
  } else {
    lines.push('  None');
  }

  // ── Next human action ─────────────────────────────────
  lines.push('');
  lines.push('NEXT ACTION FOR YOU');
  if (checkpoints.A !== 'approved' && (fileExists('architecture-decision.md'))) {
    lines.push('  Review requirements.md and architecture-decision.md, then run:');
    lines.push('  → node orchestrate.js checkpoint A');
  } else if (checkpoints.B !== 'approved' && fileExists('qa-report.md')) {
    lines.push('  Review qa-report.md and sprint-review meeting, then run:');
    lines.push('  → node orchestrate.js checkpoint B');
  } else if (meetingsPending.length > 0) {
    lines.push(`  → ${meetingsPending[0]}`);
  } else if (pending.length > 0) {
    const nextAgent = pending[0];
    lines.push(`  Wait for ${nextAgent} agent to complete, then run:`);
    lines.push(`  → node orchestrate.js advance ${nextAgent}`);
  } else if (state.phase === 'done') {
    lines.push('  Sprint is complete. Ready to ship or start next sprint:');
    lines.push('  → node orchestrate.js sprint next   (start Sprint ' + (sprint + 1) + ')');
    lines.push('  → node orchestrate.js done          (produce DONE.md)');
  } else {
    lines.push('  Check status: node orchestrate.js status');
  }

  // ── Sprint history ────────────────────────────────────
  const history = state.sprintHistory || [];
  if (history.length > 0) {
    lines.push('');
    lines.push('SPRINT HISTORY');
    for (const s of history) {
      const vel = s.planned > 0 ? `${Math.round((s.completed / s.planned) * 100)}% velocity` : '';
      lines.push(`  Sprint ${s.sprint} (${s.date}): ${s.completed}/${s.planned} stories — ${vel}`);
    }
  }

  lines.push('');
  lines.push(hr);
  lines.push('');

  const output = lines.join('\n');
  console.log(output);

  // Optionally write to REPORT.md
  const reportPath = path.join(process.cwd(), 'REPORT.md');
  fs.writeFileSync(reportPath, output.replace(/\x1b\[[0-9;]*m/g, ''));
  console.log('Report also saved to REPORT.md\n');
}

function cmd_sprint(subcommand, ...args) {
  const state = readState();
  const sprint = state.sprint || 1;

  if (!subcommand || subcommand === 'status') {
    const done = state.sprintStoriesCompleted || 0;
    const planned = state.sprintStoriesPlanned || 0;
    const deferred = state.sprintStoriesDeferred || 0;
    console.log(`\nSprint ${sprint}`);
    console.log(`Goal:      ${state.sprintGoal || '(not set — run PM agent)'}`);
    console.log(`Stories:   ${done} done / ${planned} planned / ${deferred} deferred to backlog`);
    if (planned > 0) {
      const pct = Math.round((done / planned) * 100);
      console.log(`Velocity:  ${pct}%`);
    }

    // Show backlog count if file exists
    const backlogPath = path.join(process.cwd(), 'sprint-backlog.md');
    if (fs.existsSync(backlogPath)) {
      const content = fs.readFileSync(backlogPath, 'utf8');
      const midSprintItems = (content.match(/\| \[DATE\]/g) || []).length;
      console.log(`Backlog:   sprint-backlog.md exists — check for mid-sprint discoveries`);
    }

    if (state.sprintHistory && state.sprintHistory.length > 0) {
      console.log('\nSprint History:');
      for (const s of state.sprintHistory) {
        console.log(`  Sprint ${s.sprint}: ${s.completed}/${s.planned} stories — "${s.goal}"`);
      }
    }
    console.log('');
    return;
  }

  if (subcommand === 'set-goal') {
    const goal = args.join(' ');
    if (!goal) {
      console.error('Usage: node orchestrate.js sprint set-goal "Your sprint goal here"');
      process.exit(1);
    }
    state.sprintGoal = goal;
    writeState(state);
    console.log(`✓ Sprint ${sprint} goal set: "${goal}"`);
    return;
  }

  if (subcommand === 'set-capacity') {
    const planned = parseInt(args[0]);
    if (isNaN(planned)) {
      console.error('Usage: node orchestrate.js sprint set-capacity <number>');
      process.exit(1);
    }
    state.sprintStoriesPlanned = planned;
    state.sprintStoriesCompleted = 0;
    writeState(state);
    console.log(`✓ Sprint ${sprint} capacity set: ${planned} stories`);
    return;
  }

  if (subcommand === 'complete-story') {
    state.sprintStoriesCompleted = (state.sprintStoriesCompleted || 0) + 1;
    writeState(state);
    const done = state.sprintStoriesCompleted;
    const planned = state.sprintStoriesPlanned || '?';
    console.log(`✓ Story marked complete. Sprint ${sprint} progress: ${done}/${planned}`);
    return;
  }

  if (subcommand === 'next') {
    // Archive current sprint, start next
    const history = state.sprintHistory || [];
    history.push({
      sprint,
      goal: state.sprintGoal || '',
      planned: state.sprintStoriesPlanned || 0,
      completed: state.sprintStoriesCompleted || 0,
      deferred: state.sprintStoriesDeferred || 0,
      date: new Date().toISOString().split('T')[0],
    });
    state.sprintHistory = history;
    state.sprint = sprint + 1;
    state.sprintGoal = '';
    state.sprintStoriesPlanned = 0;
    state.sprintStoriesCompleted = 0;
    state.sprintStoriesDeferred = 0;
    // Reset sprint-level state
    state.phase = 'pm';
    state.pending = ['pm'];
    state.completed = state.completed.filter(a => ['spec', 'arch'].includes(a));
    state.checkpoints = { A: 'approved', B: 'pending' };
    state.meetings = { kickoff: 'pending', 'cross-review': 'pending', 'sprint-review': 'pending' };
    writeState(state);
    console.log(`✓ Sprint ${sprint} archived. Starting Sprint ${sprint + 1}.`);
    console.log(`  Previous sprints: ${history.length} completed`);
    console.log(`  Next: Run PM agent for Sprint ${sprint + 1} planning.`);
    return;
  }

  if (subcommand === 'backlog') {
    const backlogPath = path.join(process.cwd(), 'sprint-backlog.md');
    if (!fs.existsSync(backlogPath)) {
      console.log('\nNo sprint-backlog.md found.\n');
      return;
    }
    console.log('\n' + fs.readFileSync(backlogPath, 'utf8').split('\n').slice(0, 40).join('\n'));
    console.log('\n(truncated — open sprint-backlog.md to see full backlog)\n');
    return;
  }

  console.error(`Unknown sprint subcommand: ${subcommand}`);
  console.error('Usage: node orchestrate.js sprint [status|set-goal|set-capacity|complete-story|next|backlog]');
  process.exit(1);
}

function cmd_meeting(subcommand, arg) {
  const meetingDir = path.join(process.cwd(), MEETING_DIR);

  if (!subcommand || subcommand === 'status') {
    // List all meetings and their status
    if (!fs.existsSync(meetingDir)) {
      console.log('\nNo meetings directory found — no meetings have been run yet.\n');
      return;
    }
    const files = fs.readdirSync(meetingDir).filter(f => f.endsWith('.md')).sort();
    if (files.length === 0) {
      console.log('\nNo meetings recorded yet.\n');
      return;
    }
    console.log(`\nMeetings (${files.length} total)\n`);
    for (const file of files) {
      const content = fs.readFileSync(path.join(meetingDir, file), 'utf8');
      const titleLine = content.split('\n').find(l => l.startsWith('# Meeting:'));
      const statusLine = content.split('\n').find(l => l.includes('**Status:**'));
      const title = titleLine ? titleLine.replace('# Meeting: ', '') : file;
      const status = statusLine ? statusLine.replace(/.*\*\*Status:\*\*\s*/, '').split('→').pop().trim() : '—';
      const icon = status.includes('RESOLVED') ? '✓' : status.includes('ESCALATED') ? '⚠' : '○';
      console.log(`  ${icon} ${title}`);
      console.log(`    Status: ${status}   File: meetings/${file}`);
      console.log('');
    }
    return;
  }

  if (subcommand === 'start') {
    // Create a new meeting file from the template
    const type = arg;
    if (!type || !MEETING_TYPES[type]) {
      console.error(`Usage: node orchestrate.js meeting start <type>`);
      console.error(`Types: ${Object.keys(MEETING_TYPES).join(', ')}`);
      process.exit(1);
    }
    if (!fs.existsSync(meetingDir)) {
      fs.mkdirSync(meetingDir, { recursive: true });
    }
    const state = readState();
    const sprint = state.sprint || 1;
    const date = new Date().toISOString().split('T')[0];
    const filename = `sprint-${String(sprint).padStart(2, '0')}-${type}.md`;
    const filepath = path.join(meetingDir, filename);

    if (fs.existsSync(filepath)) {
      console.log(`Meeting file already exists: meetings/${filename}`);
      console.log(`Edit it directly to add agent responses.`);
      process.exit(0);
    }

    const templatePath = path.join(process.cwd(), 'meeting.template.md');
    let content;
    if (fs.existsSync(templatePath)) {
      content = fs.readFileSync(templatePath, 'utf8')
        .replace('[Type]', type.toUpperCase())
        .replace('Sprint [N]', `Sprint ${sprint}`)
        .replace('[Date]', date)
        .replace('KICKOFF | CROSS-REVIEW | SPRINT-REVIEW', type.toUpperCase())
        .replace('[What event caused this meeting — e.g., "PLAN.md completed"]', MEETING_TYPES[type].trigger);
    } else {
      content = `# Meeting: ${type.toUpperCase()} — Sprint ${sprint} — ${date}\n> Status: OPEN\n\n(meeting.template.md not found — fill in manually)\n`;
    }

    fs.writeFileSync(filepath, content);
    console.log(`✓ Meeting created: meetings/${filename}`);
    console.log(`  Attendees: ${MEETING_TYPES[type].attendees.join(', ')}`);
    console.log(`  Next: dispatch each agent to write their section, then run:`);
    console.log(`    node orchestrate.js meeting close ${filename}`);
    return;
  }

  if (subcommand === 'close') {
    const filename = arg;
    if (!filename) {
      console.error('Usage: node orchestrate.js meeting close <filename>');
      process.exit(1);
    }
    const filepath = path.join(meetingDir, filename);
    if (!fs.existsSync(filepath)) {
      console.error(`Meeting file not found: meetings/${filename}`);
      process.exit(1);
    }
    let content = fs.readFileSync(filepath, 'utf8');

    // Check for unresolved blockers (simple heuristic: look for ESCALATED in Unresolved section)
    const hasEscalation = content.includes('ESCALATED') && !content.includes('Status: RESOLVED');
    const newStatus = hasEscalation ? 'ESCALATED' : 'RESOLVED';

    // Update status line
    content = content.replace(
      /\*\*Status:\*\* OPEN.*|> \*\*Status:\*\* OPEN.*/,
      `> **Status:** ${newStatus}`
    );

    fs.writeFileSync(filepath, content);
    console.log(`✓ Meeting closed: meetings/${filename} — Status: ${newStatus}`);
    if (newStatus === 'ESCALATED') {
      console.log(`  ⚠ Meeting has unresolved items. Pipeline is paused.`);
      console.log(`  → Human must resolve the escalated items, update the meeting file,`);
      console.log(`    then re-run: node orchestrate.js meeting close ${filename}`);
    } else {
      console.log(`  Pipeline may now advance.`);
    }
    return;
  }

  console.error(`Unknown meeting subcommand: ${subcommand}`);
  console.error('Usage: node orchestrate.js meeting [status|start <type>|close <filename>]');
  console.error(`Meeting types: ${Object.keys(MEETING_TYPES).join(', ')}`);
  process.exit(1);
}

function cmd_adr() {
  const adrDir = path.join(process.cwd(), 'adr');

  if (!fs.existsSync(adrDir)) {
    console.log('\nadr/ directory not found. No decisions recorded yet.\n');
    return;
  }

  const files = fs.readdirSync(adrDir)
    .filter(f => f.endsWith('.md') && f !== 'ADR-000-index.md')
    .sort();

  if (files.length === 0) {
    console.log('\nNo ADRs written yet (adr/ only has the index).\n');
    return;
  }

  console.log(`\nArchitecture Decision Records (${files.length} total)\n`);

  for (const file of files) {
    const content = fs.readFileSync(path.join(adrDir, file), 'utf8');
    const lines = content.split('\n');

    // Extract title (first # heading)
    const titleLine = lines.find(l => l.startsWith('# ADR-'));
    const title = titleLine ? titleLine.replace(/^#\s*/, '') : file;

    // Extract author
    const authorLine = lines.find(l => l.includes('**Author:**'));
    const author = authorLine
      ? authorLine.replace(/.*\*\*Author:\*\*\s*/, '').trim()
      : '—';

    // Extract status
    const statusLine = lines.find(l => l.includes('**Status:**'));
    const status = statusLine
      ? statusLine.replace(/.*\*\*Status:\*\*\s*/, '').trim()
      : '—';

    // Extract date
    const dateLine = lines.find(l => l.includes('**Date:**'));
    const date = dateLine
      ? dateLine.replace(/.*\*\*Date:\*\*\s*/, '').trim()
      : '—';

    const statusIcon = status.includes('DECIDED') ? '✓'
      : status.includes('SUPERSEDED') ? '↩'
      : status.includes('DEPRECATED') ? '✗'
      : '○';

    console.log(`  ${statusIcon} ${title}`);
    console.log(`    Author: ${author}   Date: ${date}   File: adr/${file}`);
    console.log('');
  }
}

function cmd_done() {
  const state = readState();
  const date = new Date().toISOString().split('T')[0];
  const projectName = state.projectName || 'Project';

  const completedList = state.completed
    .map(a => `- ${a} agent completed`)
    .join('\n');

  const artifactList = Object.entries(state.artifacts || {})
    .filter(([, done]) => done)
    .map(([f]) => `- ${f}`)
    .join('\n');

  const content = `# Project Complete: ${projectName}
> Completed: ${date}

## Delivered
${completedList || '- (none recorded)'}

## Artifacts
${artifactList || '- (none recorded)'}

## Known Limitations
- Review verify-report.json for any skipped checks

## Next Steps
- Address any items marked BLOCKED during the cycle
- Run: npx playwright test (if e2e/stories.spec.ts was generated)
- Review qa-report.md for deferred issues
`;

  fs.writeFileSync('DONE.md', content);
  console.log('✓ Written: DONE.md');
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

const [, , command, arg, arg2] = process.argv;

const restArgs = process.argv.slice(4);

switch (command) {
  case 'status':     cmd_status();                         break;
  case 'report':     cmd_report();                         break;
  case 'validate':   cmd_validate(arg);                    break;
  case 'advance':    cmd_advance(arg);                     break;
  case 'checkpoint': cmd_checkpoint(arg);                  break;
  case 'sprint':     cmd_sprint(arg, ...restArgs);         break;
  case 'meeting':    cmd_meeting(arg, arg2);               break;
  case 'adr':        cmd_adr();                            break;
  case 'verify':     cmd_verify();                         break;
  case 'run':        cmd_run();                            break;
  case 'done':       cmd_done();                           break;
  default:
    console.log('Usage: node orchestrate.js <command>');
    console.log('');
    console.log('Pipeline:');
    console.log('  status                         — technical pipeline state');
    console.log('  report                         — human-readable project status report');
    console.log('  validate <agent>               — check if agent inputs are ready');
    console.log('  advance <agent>                — mark agent complete, move to next');
    console.log('  checkpoint <A|B>               — record human approval');
    console.log('  verify                         — run typecheck, build, test, lighthouse');
    console.log('  run                            — automated pipeline');
    console.log('  done                           — produce DONE.md');
    console.log('');
    console.log('Sprint:');
    console.log('  sprint status                  — show sprint goal, progress, velocity');
    console.log('  sprint set-goal "..."          — set the sprint goal');
    console.log('  sprint set-capacity <N>        — set planned story count');
    console.log('  sprint complete-story          — mark one story done');
    console.log('  sprint next                    — archive sprint, start next');
    console.log('  sprint backlog                 — show sprint-backlog.md');
    console.log('');
    console.log('Meetings:');
    console.log('  meeting [status]               — list all meetings');
    console.log('  meeting start <type>           — create meeting file');
    console.log('  meeting close <filename>       — resolve or escalate');
    console.log('');
    console.log('Records:');
    console.log('  adr                            — list Architecture Decision Records');
    console.log('');
    console.log(`Agents: ${Object.keys(AGENT_CONTRACTS).join(', ')}`);
    console.log(`Meeting types: ${Object.keys(MEETING_TYPES).join(', ')}`);
    process.exit(1);
}
