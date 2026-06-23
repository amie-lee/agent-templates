const AGENT_CONTRACTS = {
  spec: {
    requires: [],
    produces: ["intake.md", "requirements.md", "use-cases.md", "intent.md"],
    promptFile: "agent-spec.md",
  },
  arch: {
    requires: ["intake.md", "requirements.md", "intent.md"],
    produces: ["architecture-decision.md"],
    promptFile: "agent-arch.md",
  },
  pm: {
    requires: ["requirements.md", "use-cases.md", "architecture-decision.md"],
    produces: ["PLAN.md", "sprint-backlog.md"],
    promptFile: "agent-pm.md",
  },
  design: {
    requires: ["PLAN.md"],
    produces: ["design-spec.md", "design-tokens.md"],
    promptFile: "agent-design.md",
  },
  backend: {
    requires: ["PLAN.md"],
    produces: ["api-spec.yaml", "api-samples.sh", "schema.sql"],
    promptFile: "agent-backend.md",
  },
  frontend: {
    requires: ["PLAN.md", "design-spec.md", "api-spec.yaml"],
    produces: ["api-contract.md", "verify-report.json", "src/tests/"],
    promptFile: "agent-frontend.md",
  },
  "qa-planning": {
    requires: ["PLAN.md", "requirements.md"],
    produces: ["qa-plan.md", "e2e/stories.spec.ts"],
    promptFile: "agent-qa.md",
  },
  "qa-run": {
    requires: ["PLAN.md", "qa-plan.md", "api-spec.yaml", "verify-report.json"],
    produces: ["qa-report.md"],
    promptFile: "agent-qa.md",
  },
};

module.exports = {
  AGENT_CONTRACTS,
};
