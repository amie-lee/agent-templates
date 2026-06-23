const http = require("http");
const { URL } = require("url");
const { attachRuntime, detectClaudeBinary, runAgent } = require("./runtime/claude");
const { ensureProjectRoot, listAdrs, readRuntime, readState, runOrchestrate } = require("./project");

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function getRuntimeSummary(projectRoot) {
  const runtime = readRuntime(projectRoot);
  return {
    attached: Boolean(runtime),
    runtime: runtime || null,
    detectedBinary: detectClaudeBinary(),
  };
}

function getAvailableActions(projectRoot) {
  const state = readState(projectRoot);
  const runtime = readRuntime(projectRoot);
  const actions = {
    attach: !runtime,
    runAgents: runtime ? (state.pending || []) : [],
    checkpoints: [],
    meetings: [],
    verify: state.completed.includes("frontend") || (state.pending || []).includes("qa-run"),
    refreshReport: true,
  };

  if (state.phase === "checkpoint-A") actions.checkpoints.push("A");
  if (state.phase === "checkpoint-B") actions.checkpoints.push("B");
  if (state.phase === "meeting-kickoff") actions.meetings.push({ type: "kickoff", action: "start" });
  if (state.phase === "meeting-cross-review") actions.meetings.push({ type: "cross-review", action: "start" });
  if (state.phase === "meeting-sprint-review") actions.meetings.push({ type: "sprint-review", action: "start" });

  for (const [type, record] of Object.entries(state.meetings || {})) {
    if (record && record.status === "open" && record.file) {
      actions.meetings.push({ type, action: "close", file: record.file });
    }
  }

  return actions;
}

function html() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Agent Dashboard</title>
  <style>
    body { font-family: sans-serif; margin: 0; background: #f5f5f0; color: #111; }
    main { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .hero { background: linear-gradient(135deg, #fbf1c7, #d5e8d4); padding: 20px; border-radius: 16px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 20px; }
    .card { background: white; border-radius: 14px; padding: 16px; box-shadow: 0 6px 18px rgba(0,0,0,0.08); }
    button { border: 0; border-radius: 10px; padding: 10px 14px; background: #1f6feb; color: white; cursor: pointer; margin-right: 8px; margin-bottom: 8px; }
    button.secondary { background: #444; }
    pre { background: #111; color: #f8f8f2; padding: 12px; border-radius: 10px; overflow: auto; }
    ul { padding-left: 18px; }
  </style>
</head>
<body>
  <main>
    <div class="hero">
      <h1>Agent Dashboard</h1>
      <p id="next-action">Loading next action…</p>
      <div id="top-actions"></div>
    </div>
    <div class="grid">
      <section class="card"><h2>Runtime</h2><pre id="runtime"></pre></section>
      <section class="card"><h2>Pipeline State</h2><pre id="state"></pre></section>
      <section class="card"><h2>Available Actions</h2><div id="actions"></div></section>
      <section class="card"><h2>ADRs</h2><ul id="adrs"></ul></section>
    </div>
  </main>
  <script>
    async function api(path, options) {
      const response = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    async function runAction(url, body) {
      try {
        await api(url, { method: 'POST', body: JSON.stringify(body || {}) });
        await refresh();
      } catch (error) {
        alert(error.message);
      }
    }

    function renderButtons(actions) {
      const actionBox = document.getElementById('actions');
      const heroActions = document.getElementById('top-actions');
      actionBox.innerHTML = '';
      heroActions.innerHTML = '';

      if (actions.attach) {
        const button = document.createElement('button');
        button.textContent = 'Attach Runtime';
        button.onclick = () => runAction('/api/attach');
        heroActions.appendChild(button.cloneNode(true));
        button.onclick = () => runAction('/api/attach');
        actionBox.appendChild(button);
      }

      for (const agent of actions.runAgents) {
        const button = document.createElement('button');
        button.textContent = 'Run Agent: ' + agent;
        button.onclick = () => runAction('/api/run-agent', { agent });
        actionBox.appendChild(button);
      }

      for (const checkpoint of actions.checkpoints) {
        const button = document.createElement('button');
        button.textContent = 'Approve Checkpoint ' + checkpoint;
        button.onclick = () => runAction('/api/checkpoint', { label: checkpoint });
        actionBox.appendChild(button);
      }

      for (const meeting of actions.meetings) {
        const button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = meeting.action === 'start'
          ? 'Start Meeting: ' + meeting.type
          : 'Close Meeting: ' + meeting.file;
        button.onclick = () => runAction(
          meeting.action === 'start' ? '/api/meeting/start' : '/api/meeting/close',
          meeting.action === 'start' ? { type: meeting.type } : { filename: meeting.file }
        );
        actionBox.appendChild(button);
      }

      if (actions.verify) {
        const button = document.createElement('button');
        button.textContent = 'Run Verify';
        button.onclick = () => runAction('/api/verify');
        actionBox.appendChild(button);
      }

      const refreshButton = document.createElement('button');
      refreshButton.className = 'secondary';
      refreshButton.textContent = 'Refresh Report';
      refreshButton.onclick = () => runAction('/api/report/refresh');
      actionBox.appendChild(refreshButton);
    }

    async function refresh() {
      const [runtime, state, actions, adrs] = await Promise.all([
        api('/api/runtime'),
        api('/api/state'),
        api('/api/actions'),
        api('/api/adrs'),
      ]);

      document.getElementById('runtime').textContent = JSON.stringify(runtime, null, 2);
      document.getElementById('state').textContent = JSON.stringify(state, null, 2);
      document.getElementById('next-action').textContent =
        state.pending && state.pending.length > 0
          ? 'Next suggested action: ' + state.pending[0]
          : 'Waiting on: ' + state.phase;

      renderButtons(actions);

      const adrsList = document.getElementById('adrs');
      adrsList.innerHTML = '';
      for (const adr of adrs.items) {
        const li = document.createElement('li');
        li.textContent = adr.title + ' (' + adr.file + ')';
        adrsList.appendChild(li);
      }
    }

    refresh();
  </script>
</body>
</html>`;
}

function respondJson(res, statusCode, value) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

function createServer(projectRoot) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");

    try {
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html());
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/runtime") {
        respondJson(res, 200, getRuntimeSummary(projectRoot));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/state") {
        respondJson(res, 200, readState(projectRoot));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/actions") {
        respondJson(res, 200, getAvailableActions(projectRoot));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/adrs") {
        respondJson(res, 200, { items: listAdrs(projectRoot) });
        return;
      }

      const body = req.method === "POST" ? await readRequestBody(req) : {};

      if (req.method === "POST" && url.pathname === "/api/attach") {
        const runtime = attachRuntime(projectRoot);
        respondJson(res, 200, runtime);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/run-agent") {
        const result = runAgent(projectRoot, body.agent, { launch: false });
        respondJson(res, 200, result);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/checkpoint") {
        const result = runOrchestrate(projectRoot, ["checkpoint", body.label]);
        if (result.status !== 0) throw new Error(result.stderr || result.stdout);
        respondJson(res, 200, { output: result.stdout });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/meeting/start") {
        const result = runOrchestrate(projectRoot, ["meeting", "start", body.type]);
        if (result.status !== 0) throw new Error(result.stderr || result.stdout);
        respondJson(res, 200, { output: result.stdout });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/meeting/close") {
        const result = runOrchestrate(projectRoot, ["meeting", "close", body.filename]);
        if (result.status !== 0) throw new Error(result.stderr || result.stdout);
        respondJson(res, 200, { output: result.stdout });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/verify") {
        const result = runOrchestrate(projectRoot, ["verify"]);
        if (result.status !== 0 && !result.stdout.includes("Written: verify-report.json")) {
          throw new Error(result.stderr || result.stdout);
        }
        respondJson(res, 200, { output: result.stdout });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/report/refresh") {
        const result = runOrchestrate(projectRoot, ["report"]);
        if (result.status !== 0) throw new Error(result.stderr || result.stdout);
        respondJson(res, 200, { output: result.stdout });
        return;
      }

      respondJson(res, 404, { error: "Not found" });
    } catch (error) {
      respondJson(res, 400, { error: error.message });
    }
  });
}

function startDashboard(startDir = process.cwd()) {
  const projectRoot = ensureProjectRoot(startDir);
  const server = createServer(projectRoot);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${address.port}`,
        projectRoot,
      });
    });
  });
}

module.exports = {
  createServer,
  getAvailableActions,
  getRuntimeSummary,
  startDashboard,
};
