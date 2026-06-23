const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { AGENT_CONTRACTS } = require("../contracts");
const {
  ensureProjectRoot,
  readRuntime,
  readState,
  runOrchestrate,
  writeBootstrap,
  writeRunRequest,
  writeRuntime,
} = require("../project");

const CANDIDATE_BINARIES = ["claude", "claude-code", "claudecode"];

function findExecutable(command) {
  const pathEntries = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    const candidate = path.join(entry, command);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function detectClaudeBinary() {
  if (process.env.AGENT_CLAUDE_BIN) {
    return process.env.AGENT_CLAUDE_BIN;
  }
  for (const candidate of CANDIDATE_BINARIES) {
    const binary = findExecutable(candidate);
    if (binary) return binary;
  }
  return null;
}

function createBootstrapPrompt(projectRoot, agentName, validationOutput, payload) {
  return [
    `# Claude Code Bootstrap`,
    ``,
    `Project root: ${projectRoot}`,
    `Run target: ${agentName}`,
    `Prompt file: ${payload.promptFile}`,
    ``,
    `## Current state summary`,
    `Phase: ${payload.state.phase}`,
    `Pending: ${(payload.state.pending || []).join(", ") || "none"}`,
    `Completed: ${(payload.state.completed || []).join(", ") || "none"}`,
    ``,
    `## Validation output`,
    validationOutput.trim() || "(none)",
    ``,
    `## Expected outputs`,
    ...payload.expectedOutputs.map((item) => `- ${item}`),
    ``,
    `## Instruction`,
    `Open ${payload.promptFile} and execute the ${agentName} agent for this project. When complete, follow the project CLAUDE.md rules.`,
    ``,
  ].join("\n");
}

function attachRuntime(startDir = process.cwd()) {
  const projectRoot = ensureProjectRoot(startDir);
  const binary = detectClaudeBinary();
  if (!binary) {
    throw new Error("Claude Code CLI not found. Install it or set AGENT_CLAUDE_BIN to the executable path.");
  }

  const runtime = {
    runtime: "claude-code",
    binary,
    attachedAt: new Date().toISOString(),
    projectRoot,
    defaultEntryAgent: "spec",
    lastRunAgent: null,
    sessionMode: "cli-manual",
  };
  writeRuntime(projectRoot, runtime);

  writeBootstrap(
    projectRoot,
    [
      `# Runtime Attached`,
      ``,
      `Runtime: Claude Code`,
      `Project root: ${projectRoot}`,
      `Default entry agent: spec`,
      ``,
      `Next step: run "agent run spec" or open "agent dashboard".`,
      ``,
    ].join("\n")
  );

  return runtime;
}

function ensureAttached(projectRoot) {
  const runtime = readRuntime(projectRoot);
  if (!runtime) {
    throw new Error(`Runtime not attached. Run "agent attach" in ${projectRoot} first.`);
  }
  if (runtime.projectRoot !== projectRoot) {
    throw new Error("Runtime metadata points to a different project root. Re-run agent attach.");
  }
  return runtime;
}

function buildRunPayload(projectRoot, agentName) {
  const state = readState(projectRoot);
  const contract = AGENT_CONTRACTS[agentName];
  const promptFileName = contract.promptFile;
  return {
    runtime: "claude-code",
    projectRoot,
    agent: agentName,
    promptFile: path.join(projectRoot, "agents", promptFileName),
    validationCommand: `node orchestrate.js validate ${agentName}`,
    expectedOutputs: contract.produces,
    state,
    createdAt: new Date().toISOString(),
  };
}

function runAgent(startDir, agentName, options = {}) {
  const projectRoot = ensureProjectRoot(startDir);
  const runtime = ensureAttached(projectRoot);
  if (!AGENT_CONTRACTS[agentName]) {
    throw new Error(`Unknown agent "${agentName}".`);
  }

  const validation = runOrchestrate(projectRoot, ["validate", agentName]);
  if (validation.status !== 0) {
    throw new Error(validation.stdout || validation.stderr || `Agent ${agentName} is not ready to run.`);
  }

  const payload = buildRunPayload(projectRoot, agentName);
  writeRunRequest(projectRoot, payload);
  fs.writeFileSync(path.join(projectRoot, ".current-agent"), agentName);
  writeBootstrap(projectRoot, createBootstrapPrompt(projectRoot, agentName, validation.stdout, payload));

  runtime.lastRunAgent = agentName;
  runtime.lastRunAt = new Date().toISOString();
  writeRuntime(projectRoot, runtime);

  if (options.launch === false) {
    return {
      launched: false,
      payload,
      runtime,
    };
  }

  const launch = spawnSync(runtime.binary, [], {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (launch.status !== 0) {
    throw new Error(`Claude Code exited with status ${launch.status}.`);
  }

  return {
    launched: true,
    payload,
    runtime,
  };
}

module.exports = {
  attachRuntime,
  buildRunPayload,
  detectClaudeBinary,
  runAgent,
};
