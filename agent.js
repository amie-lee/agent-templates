#!/usr/bin/env node

const { initProject } = require("./lib/scaffold");
const { startDashboard } = require("./lib/dashboard");
const { attachRuntime, runAgent } = require("./lib/runtime/claude");
const { ensureProjectRoot, runOrchestrate } = require("./lib/project");

async function main() {
  const [, , command, ...args] = process.argv;

  if (!command || ["-h", "--help", "help"].includes(command)) {
    console.log("Usage: agent <command>");
    console.log("");
    console.log("Core:");
    console.log("  agent init <project>");
    console.log("  agent attach");
    console.log("  agent run <agent-name>");
    console.log("  agent dashboard");
    console.log("");
    console.log("Project:");
    console.log("  agent status|report|validate|advance|checkpoint|meeting|sprint|adr|verify|done");
    process.exit(command ? 0 : 1);
  }

  if (command === "init") {
    initProject(args[0], { templateRoot: __dirname });
    return;
  }

  if (command === "attach") {
    const runtime = attachRuntime(process.cwd());
    console.log(`✓ Attached Claude Code runtime at ${runtime.projectRoot}`);
    console.log(`  Binary: ${runtime.binary}`);
    console.log(`  Next: agent run ${runtime.defaultEntryAgent}`);
    return;
  }

  if (command === "run") {
    const agentName = args[0];
    if (!agentName) {
      throw new Error('Usage: agent run <agent-name>');
    }
    const result = runAgent(process.cwd(), agentName);
    console.log(`✓ Prepared and launched ${agentName}`);
    console.log(`  Prompt: ${result.payload.promptFile}`);
    return;
  }

  if (command === "dashboard") {
    const { url } = await startDashboard(process.cwd());
    console.log(`Dashboard running at ${url}`);
    return;
  }

  const projectRoot = ensureProjectRoot(process.cwd());
  const result = runOrchestrate(projectRoot, [command, ...args], { stdio: "inherit" });
  process.exit(result.status || 0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
