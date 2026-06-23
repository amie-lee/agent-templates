const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function isAgentProject(rootDir) {
  return (
    fs.existsSync(path.join(rootDir, "cycle-state.json")) &&
    fs.existsSync(path.join(rootDir, "agents")) &&
    fs.existsSync(path.join(rootDir, "CLAUDE.md")) &&
    fs.existsSync(path.join(rootDir, "orchestrate.js"))
  );
}

function findProjectRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);
  while (true) {
    if (isAgentProject(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function ensureProjectRoot(startDir = process.cwd()) {
  const root = findProjectRoot(startDir);
  if (!root) {
    throw new Error("Not inside an agent project. Run this command from a scaffolded project root.");
  }
  return root;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function readState(projectRoot) {
  return readJson(path.join(projectRoot, "cycle-state.json"));
}

function runtimeDir(projectRoot) {
  return path.join(projectRoot, ".agent");
}

function runtimeFile(projectRoot) {
  return path.join(runtimeDir(projectRoot), "runtime.json");
}

function bootstrapFile(projectRoot) {
  return path.join(runtimeDir(projectRoot), "bootstrap.md");
}

function runRequestFile(projectRoot) {
  return path.join(runtimeDir(projectRoot), "run-request.json");
}

function readRuntime(projectRoot) {
  return readJson(runtimeFile(projectRoot));
}

function writeRuntime(projectRoot, value) {
  writeJson(runtimeFile(projectRoot), value);
}

function writeBootstrap(projectRoot, content) {
  fs.mkdirSync(runtimeDir(projectRoot), { recursive: true });
  fs.writeFileSync(bootstrapFile(projectRoot), content);
}

function writeRunRequest(projectRoot, payload) {
  writeJson(runRequestFile(projectRoot), payload);
}

function runOrchestrate(projectRoot, args, options = {}) {
  const result = spawnSync(
    process.execPath,
    [path.join(projectRoot, "orchestrate.js"), ...args],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: options.env || process.env,
      stdio: options.stdio || "pipe",
    }
  );
  return result;
}

function readMarkdownTitle(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const line = fs.readFileSync(filePath, "utf8").split("\n").find((entry) => entry.startsWith("# "));
  return line ? line.replace(/^# /, "").trim() : null;
}

function listAdrs(projectRoot) {
  const adrDir = path.join(projectRoot, "adr");
  if (!fs.existsSync(adrDir)) return [];

  return fs.readdirSync(adrDir)
    .filter((file) => file.endsWith(".md") && !["ADR-000-index.md", "adr.template.md"].includes(file))
    .sort()
    .map((file) => ({
      file,
      title: readMarkdownTitle(path.join(adrDir, file)) || file,
    }));
}

module.exports = {
  bootstrapFile,
  ensureProjectRoot,
  findProjectRoot,
  isAgentProject,
  listAdrs,
  readRuntime,
  readState,
  runOrchestrate,
  runRequestFile,
  runtimeDir,
  runtimeFile,
  writeBootstrap,
  writeRunRequest,
  writeRuntime,
};
