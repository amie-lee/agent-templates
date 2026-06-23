#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = __dirname;
const nodeBin = process.execPath;
const initScript = path.join(repoRoot, 'agent-init.js');

function run(cwd, ...args) {
  return execFileSync(nodeBin, args, { cwd, encoding: 'utf8' });
}

function writeArtifact(projectDir, relativePath, content) {
  const fullPath = path.join(projectDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-templates-'));
const projectDir = path.join(baseDir, 'review-project');

run(repoRoot, initScript, projectDir);

assert(fs.existsSync(projectDir), 'project directory should be created at the requested path');
assert(fs.existsSync(path.join(projectDir, 'intent.md')), 'intent.md should be scaffolded');
assert(fs.existsSync(path.join(projectDir, 'meetings', 'meeting.template.md')), 'meeting template should exist in meetings/');
assert(fs.existsSync(path.join(projectDir, 'sprint-plan.template.md')), 'sprint plan template should be scaffolded');

let output = run(projectDir, 'orchestrate.js', 'status');
assert(output.includes('Phase:     spec'), 'initial phase should be spec');
assert(output.includes('○ intake.md template/not completed'), 'template artifacts should not appear completed');

let blocked = false;
try {
  run(projectDir, 'orchestrate.js', 'advance', 'spec');
} catch (error) {
  blocked = true;
}
assert(blocked, 'advance spec should fail until completed outputs replace the templates');

writeArtifact(projectDir, 'intake.md', '# Project Intake\n\nCompleted intake.\n');
writeArtifact(projectDir, 'requirements.md', '# Requirements\n\n## Intent\nCompleted requirements.\n');
writeArtifact(projectDir, 'use-cases.md', '# Use Cases\n\nCompleted use cases.\n');
writeArtifact(projectDir, 'intent.md', '# Intent\n\n## Launch Goal\nShip a real release.\n');

run(projectDir, 'orchestrate.js', 'advance', 'spec');
output = run(projectDir, 'orchestrate.js', 'status');
assert(output.includes('Phase:     arch'), 'after spec the next phase should be arch');

blocked = false;
try {
  run(projectDir, 'orchestrate.js', 'checkpoint', 'A');
} catch (error) {
  blocked = true;
}
assert(blocked, 'checkpoint A should be blocked before architecture completes');

writeArtifact(projectDir, 'architecture-decision.md', '# Architecture Decision\n\nWe will use a documented architecture.\n');
run(projectDir, 'orchestrate.js', 'advance', 'arch');
output = run(projectDir, 'orchestrate.js', 'status');
assert(output.includes('Phase:     checkpoint-A'), 'after arch the pipeline should wait for checkpoint A');
assert(output.includes('Pending:   none'), 'checkpoint wait should not dispatch PM');

run(projectDir, 'orchestrate.js', 'checkpoint', 'A');
output = run(projectDir, 'orchestrate.js', 'status');
assert(output.includes('Phase:     pm'), 'after checkpoint A the PM phase should unlock');

writeArtifact(projectDir, 'PLAN.md', '# PLAN\n\n## Overview\nCompleted sprint scope.\n');
writeArtifact(projectDir, 'sprint-backlog.md', '# Sprint Backlog\n\n## Product Backlog\nNo deferred items.\n');
run(projectDir, 'orchestrate.js', 'advance', 'pm');
output = run(projectDir, 'orchestrate.js', 'status');
assert(output.includes('Phase:     meeting-kickoff'), 'after PM the kickoff meeting should gate progress');

blocked = false;
try {
  run(projectDir, 'orchestrate.js', 'meeting', 'start', 'cross-review');
} catch (error) {
  blocked = true;
}
assert(blocked, 'cross-review should be blocked until design and backend complete');

run(projectDir, 'orchestrate.js', 'meeting', 'start', 'kickoff');
run(projectDir, 'orchestrate.js', 'meeting', 'close', 'sprint-01-kickoff.md');
output = run(projectDir, 'orchestrate.js', 'status');
assert(output.includes('Phase:     sprint-work'), 'kickoff resolution should unlock parallel sprint work');
assert(output.includes('Pending:   design, backend, qa-planning'), 'parallel agents should be pending together');
assert(output.includes('✓ Kickoff'), 'meeting state should be reflected in status');

writeArtifact(projectDir, 'design-spec.md', '# Design Spec\n\nCompleted design spec.\n');
writeArtifact(projectDir, 'design-tokens.md', '# Design Tokens\n\nCompleted design tokens.\n');
writeArtifact(projectDir, 'api-spec.yaml', 'openapi: 3.0.0\ninfo:\n  title: Demo API\n  version: 1.0.0\n');
writeArtifact(projectDir, 'api-samples.sh', '#!/usr/bin/env bash\necho sample\n');
writeArtifact(projectDir, 'schema.sql', 'create table demo(id integer primary key);\n');
writeArtifact(projectDir, 'qa-plan.md', '# QA Plan\n\nCompleted QA plan.\n');
writeArtifact(projectDir, 'e2e/stories.spec.ts', "import { test } from '@playwright/test';\n\ntest('story', async () => {});\n");
run(projectDir, 'orchestrate.js', 'advance', 'design');
run(projectDir, 'orchestrate.js', 'advance', 'backend');
run(projectDir, 'orchestrate.js', 'advance', 'qa-planning');
output = run(projectDir, 'orchestrate.js', 'status');
assert(output.includes('Phase:     meeting-cross-review'), 'cross-review should gate frontend after parallel work');

run(projectDir, 'orchestrate.js', 'meeting', 'start', 'cross-review');
run(projectDir, 'orchestrate.js', 'meeting', 'close', 'sprint-01-cross-review.md');
output = run(projectDir, 'orchestrate.js', 'status');
assert(output.includes('Phase:     frontend'), 'frontend should unlock after cross-review');

writeArtifact(projectDir, 'api-contract.md', '# API Contract\n\nCompleted API contract.\n');
writeArtifact(projectDir, 'src/tests/app.test.ts', 'export {};\n');
writeArtifact(projectDir, 'verify-report.json', JSON.stringify({ ok: true }, null, 2));
run(projectDir, 'orchestrate.js', 'advance', 'frontend');
output = run(projectDir, 'orchestrate.js', 'status');
assert(output.includes('Phase:     qa-run'), 'qa-run should follow frontend');

writeArtifact(projectDir, 'qa-report.md', '# QA Report\n\nCompleted QA report.\n');
run(projectDir, 'orchestrate.js', 'advance', 'qa-run');
output = run(projectDir, 'orchestrate.js', 'status');
assert(output.includes('Phase:     meeting-sprint-review'), 'sprint review should gate checkpoint B');

blocked = false;
try {
  run(projectDir, 'orchestrate.js', 'checkpoint', 'B');
} catch (error) {
  blocked = true;
}
assert(blocked, 'checkpoint B should be blocked before sprint-review resolves');

run(projectDir, 'orchestrate.js', 'meeting', 'start', 'sprint-review');
run(projectDir, 'orchestrate.js', 'meeting', 'close', 'sprint-01-sprint-review.md');
output = run(projectDir, 'orchestrate.js', 'status');
assert(output.includes('Phase:     checkpoint-B'), 'checkpoint B should gate DONE.md');

let doneFailed = false;
try {
  run(projectDir, 'orchestrate.js', 'done');
} catch (error) {
  doneFailed = true;
}
assert(doneFailed, 'DONE.md should be blocked before checkpoint B');

run(projectDir, 'orchestrate.js', 'checkpoint', 'B');
run(projectDir, 'orchestrate.js', 'done');
assert(fs.existsSync(path.join(projectDir, 'DONE.md')), 'DONE.md should be created after checkpoint B');

console.log('smoke-test passed');
