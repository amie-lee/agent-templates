#!/usr/bin/env node
/**
 * orchestrate.js
 * Pipeline controller for agent-driven development projects.
 * Usage: node orchestrate.js <command> [arg]
 *
 * Commands:
 *   status              — show current cycle-state.json
 *   validate <agent>    — check if agent's required inputs exist
 *   advance <agent>     — mark agent complete, update state
 *   verify              — run typecheck, build, test, lighthouse
 *   run                 — automated pipeline (polls for each advance)
 *   done                — produce DONE.md
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Agent contracts ──────────────────────────────────────────────────────────
// Note: Backend precedes Frontend because frontend requires api-spec.yaml

const AGENT_CONTRACTS = {
  design: {
    requires: ['PLAN.md'],
    produces: ['design-spec.md', 'design-tokens.md'],
  },
  backend: {
    requires: ['PLAN.md'],
    produces: ['api-spec.yaml', 'api-samples.sh', 'schema.sql'],
  },
  frontend: {
    requires: ['PLAN.md', 'design-spec.md', 'api-spec.yaml'],
    produces: ['verify-report.json', 'src/tests/'],
  },
  qa: {
    requires: ['PLAN.md', 'api-spec.yaml', 'verify-report.json'],
    produces: ['qa-report.md'],
  },
};

const AGENT_PIPELINE = ['pm', 'design', 'backend', 'frontend', 'qa'];

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

  console.log(`\nPhase:     ${state.phase}`);
  console.log(`Completed: ${state.completed.join(', ') || 'none'}`);
  console.log(`Pending:   ${state.pending.join(', ') || 'none'}`);
  if (state.blockers && state.blockers.length) {
    console.log(`Blockers:  ${state.blockers.join(', ')}`);
  }

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

  if (agent === 'pm') {
    console.log('✓ pm has no file prerequisites — ready to run');
    process.exit(0);
  }

  const contract = AGENT_CONTRACTS[agent];
  if (!contract) {
    console.error(`Unknown agent: ${agent}`);
    console.error(`Valid agents: pm, ${Object.keys(AGENT_CONTRACTS).join(', ')}`);
    process.exit(1);
  }

  const missing = contract.requires.filter(f => !fileExists(f));

  if (missing.length === 0) {
    console.log(`✓ ${agent} is ready to run`);
    console.log(`  Requires: ${contract.requires.join(', ')}`);
    process.exit(0);
  } else {
    console.log('PIPELINE STOPPED');
    console.log(`Agent: ${agent}`);
    console.log(`Missing: ${missing.join(', ')}`);
    console.log(`Action needed: Create or fill in the missing files listed above`);
    process.exit(1);
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

const [, , command, arg] = process.argv;

switch (command) {
  case 'status':   cmd_status();        break;
  case 'validate': cmd_validate(arg);   break;
  case 'advance':  cmd_advance(arg);    break;
  case 'verify':   cmd_verify();        break;
  case 'run':      cmd_run();           break;
  case 'done':     cmd_done();          break;
  default:
    console.log('Usage: node orchestrate.js <command>');
    console.log('Commands:');
    console.log('  status              — show current pipeline state');
    console.log('  validate <agent>    — check if agent inputs are ready');
    console.log('  advance <agent>     — mark agent complete, move to next');
    console.log('  verify              — run typecheck, build, test, lighthouse');
    console.log('  run                 — automated pipeline (polls for each advance)');
    console.log('  done                — produce DONE.md');
    console.log('');
    console.log(`Valid agents: pm, ${Object.keys(AGENT_CONTRACTS).join(', ')}`);
    process.exit(1);
}
