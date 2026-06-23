#!/usr/bin/env node

const { initProject } = require("./lib/scaffold");

function main() {
  const projectName = process.argv[2];

  if (!projectName) {
    console.error("Usage: agent-init <project-name>");
    console.error("Example: agent-init my-todo-app");
    process.exit(1);
  }

  try {
    initProject(projectName, { templateRoot: __dirname });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
