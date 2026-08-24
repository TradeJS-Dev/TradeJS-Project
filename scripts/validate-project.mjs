import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertExactTradejsVersion } from "./tradejs-version.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const focusedStrategySkills = [
  "strategy-candidate-report",
  "strategy-candidate-compare",
  "strategy-improvement-plan",
  "strategy-improvement-research",
  "strategy-period-revalidate",
  "strategy-forward-start",
  "strategy-forward-status",
  "strategy-risk-scale",
];

const requiredFiles = [
  ".env.example",
  ".github/workflows/publish.yml",
  ".github/workflows/package-update.yml",
  ".github/dependabot.yml",
  ".codex/skills/ai-train-local-research/SKILL.md",
  ".codex/skills/backtest-config-redis/SKILL.md",
  ".codex/skills/runtime-parity-mismatch-analysis/SKILL.md",
  ".codex/skills/save-strategy-config-from-backtest/SKILL.md",
  ".codex/skills/strategy-backtest-research/SKILL.md",
  ...focusedStrategySkills.map(
    (skillName) => `.codex/skills/${skillName}/SKILL.md`,
  ),
  ".codex/skills/strategy-release/SKILL.md",
  ".codex/skills/strategy-release/agents/openai.yaml",
  "Dockerfile",
  "cronjob",
  "config/runtime/index.ts",
  "config/runtime/deployments/production.ts",
  "config/runtime/strategies/double-tap.ts",
  "config/runtime/strategies/trend-follow.ts",
  "config/runtime/strategies/trend-shift.ts",
  "config/runtime/ticker-sets/trend-follow-20260818.ts",
  "deploy/runtime.env",
  "docker-compose.dev.yml",
  "entrypoint.sh",
  "scripts/research-notes-check.mjs",
  "scripts/runtime-entrypoint.test.mjs",
  "scripts/project-workflows.test.mjs",
  "scripts/project-image-smoke.sh",
  "scripts/tradejs-version.mjs",
  "scripts/tradejs-version.test.mjs",
  "scripts/write-runtime-package-manifest.mjs",
  "scripts/runtime-package-manifest.test.mjs",
  "scripts/validate-runtime-composition.mjs",
  "tradejs.config.ts",
  "tsconfig.json",
  "yarn.lock",
];
for (const relativePath of requiredFiles) {
  assert(
    fs.existsSync(path.join(root, relativePath)),
    `Missing ${relativePath}`,
  );
}

const packageJson = JSON.parse(read("package.json"));
assert(packageJson.private === true, "TradeJS-Project must remain private");
const tradejsDependencies = Object.entries(packageJson.dependencies).filter(
  ([name]) => name.startsWith("@tradejs/"),
);
assert(
  tradejsDependencies.some(([name]) => name === "@tradejs/base"),
  "TradeJS-Project must depend on @tradejs/base",
);
for (const [name, version] of tradejsDependencies) {
  assertExactTradejsVersion(name, version);
}
const strategyDependencies = Object.entries(packageJson.dependencies).filter(
  ([name]) =>
    name.startsWith("@tradejs/strategy-") && name !== "@tradejs/strategy-kit",
);
assert(
  strategyDependencies.length === 20,
  "All 20 strategy packages must be direct dependencies",
);
assert(
  !Object.hasOwn(packageJson.dependencies, "@tradejs/strategies"),
  "TradeJS-Project must not depend on the removed strategy monolith",
);
assert(
  packageJson.scripts.checks ===
    "yarn format:check && yarn typecheck && yarn validate && yarn test && yarn notes:check && yarn runtime:manifest && yarn runtime:validate && NODE_ENV=production yarn build",
  "Unexpected checks contour",
);
assert(
  packageJson.scripts.test ===
    "node --test ./scripts/*.test.mjs ./.codex/skills/*/scripts/*.test.mjs",
  "Project tests must include repository-owned skill tooling",
);
for (const scriptName of [
  "backtest",
  "replay",
  "ai-export",
  "ai-pocket-search",
  "ai-train",
  "research:auto",
  "research:core",
  "runtime-control",
  "runtime:manifest",
  "runtime:validate",
  "typecheck",
  "notes:check",
]) {
  assert(packageJson.scripts[scriptName], `Missing ${scriptName} script`);
}

const config = read("tradejs.config.ts");
const runtimeConfig = [
  "config/runtime/index.ts",
  "config/runtime/deployments/production.ts",
  "config/runtime/strategies/double-tap.ts",
  "config/runtime/strategies/trend-follow.ts",
  "config/runtime/strategies/trend-shift.ts",
]
  .map(read)
  .join("\n");
assert(
  config.includes("defineConfig(basePreset, { runtime })"),
  "basePreset is not active",
);
for (const expectedRuntimeConfig of [
  "production: productionDeployment",
  'accountId: "bybit-default"',
  "DoubleTap: doubleTapRuntime",
  "TrendFollow: trendFollowRuntime",
  "enabled: true",
  'INTERVAL: "15"',
  'UNIVERSE: "crypto"',
  'POLICY_PROFILE_ID: "crypto"',
]) {
  assert(
    runtimeConfig.includes(expectedRuntimeConfig),
    `Missing production runtime declaration: ${expectedRuntimeConfig}`,
  );
}
assert(
  !/\bversion\s*:/.test(runtimeConfig),
  "Runtime declarations must not contain manual versions",
);
assert(
  (runtimeConfig.match(/satisfies RuntimeStrategyDeclaration/g) ?? [])
    .length === 3,
  "Every runtime strategy declaration must have a TypeScript contract",
);
assert(
  runtimeConfig.includes("selection: { tickers: trendFollowTickers }"),
  "TrendFollow must keep its frozen ticker selection",
);
for (const forbiddenRuntimeField of [
  "releaseVersion",
  "deploymentStrategy.config",
  "ACCOUNT_ID:",
]) {
  assert(
    !`${config}\n${runtimeConfig}`.includes(forbiddenRuntimeField),
    `Legacy runtime field remains: ${forbiddenRuntimeField}`,
  );
}

const gitignore = read(".gitignore");
for (const artifactDirectory of [
  "data/",
  "notes/",
  "output/",
  "runtime-package-manifest.json",
]) {
  assert(
    gitignore.includes(artifactDirectory),
    `${artifactDirectory} must stay ignored`,
  );
}

const focusedSkillContents = new Map(
  focusedStrategySkills.map((skillName) => [
    skillName,
    read(`.codex/skills/${skillName}/SKILL.md`),
  ]),
);
for (const [skillName, skill] of focusedSkillContents) {
  assert(
    skill.includes(`name: ${skillName}`),
    `${skillName} must keep its skill identity`,
  );
}

const strategyReleaseSkill = read(".codex/skills/strategy-release/SKILL.md");
assert(
  strategyReleaseSkill.includes("Strategy Release (Deprecated)") &&
    focusedStrategySkills.every((skillName) =>
      strategyReleaseSkill.includes(`$${skillName}`),
    ),
  "strategy-release must remain a deprecated focused-skill router",
);

const improvementResearchSkill = focusedSkillContents.get(
  "strategy-improvement-research",
);
assert(
  improvementResearchSkill.includes("PROJECT_CWD") &&
    improvementResearchSkill.includes("TRADEJS_SOURCE_REPOSITORY_ROOT") &&
    improvementResearchSkill.includes("Do not push") &&
    improvementResearchSkill.includes("$strategy-forward-start"),
  "strategy-improvement-research must separate research from runtime mutation",
);

const forwardStartSkill = focusedSkillContents.get("strategy-forward-start");
for (const requiredForwardContract of [
  "MAX_LOSS_VALUE=1",
  "operator-directed prospective mode",
  "commit and push the complete accumulated release range",
  "Git-owned Project runtime configuration",
  "Run strict Project checks and runtime-control verification",
  "strategyRevision",
  "deploymentCompositionId",
]) {
  assert(
    forwardStartSkill.includes(requiredForwardContract),
    `strategy-forward-start is missing: ${requiredForwardContract}`,
  );
}
assert(
  /never start an interactive\s+authentication flow/.test(forwardStartSkill),
  "strategy-forward-start must prohibit interactive authentication",
);
assert(
  !forwardStartSkill.includes("runtime-config") &&
    !forwardStartSkill.includes("releaseVersion"),
  "strategy-forward-start must use the Git-owned runtime config flow",
);

const forwardStatusSkill = focusedSkillContents.get("strategy-forward-status");
assert(
  forwardStatusSkill.includes("This skill is read-only") &&
    forwardStatusSkill.includes("Do not edit source/config") &&
    forwardStatusSkill.includes("deploymentCompositionId"),
  "strategy-forward-status must remain read-only and composition-aware",
);

const riskScaleSkill = focusedSkillContents.get("strategy-risk-scale");
assert(
  riskScaleSkill.includes("Change only `MAX_LOSS_VALUE`") &&
    riskScaleSkill.includes("currently deployed composition only") &&
    riskScaleSkill.includes("complete Project release range"),
  "strategy-risk-scale must preserve composition and change only risk",
);

const strategyReleaseAgent = read(
  ".codex/skills/strategy-release/agents/openai.yaml",
);
assert(
  strategyReleaseAgent.includes("Strategy Release (Deprecated)") &&
    strategyReleaseAgent.includes("compatibility router"),
  "strategy-release agent metadata must advertise deprecation",
);

const runtimeEnv = read("deploy/runtime.env");
assert(
  /^SIGNALS_DAEMON_DEPLOYMENT_ID=production$/m.test(runtimeEnv),
  "Production signals daemon must select the canonical deployment explicitly",
);
assert(
  !runtimeEnv.includes("trendfollow-forward-loss-guard-20260818"),
  "Legacy TrendFollow deployment id must not remain in runtime.env",
);
for (const secretName of [
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "AI_API_KEY",
  "AGENT_GITHUB_TOKEN",
  "PG_PASSWORD",
]) {
  assert(
    !new RegExp(`^${secretName}=`, "m").test(runtimeEnv),
    `${secretName} must be injected by TradeJS-Deploy`,
  );
}

const dockerfile = read("Dockerfile");
assert(
  dockerfile.includes("yarn install --immutable"),
  "Docker install is mutable",
);
assert(
  dockerfile.includes("runtime-package-manifest.json") &&
    dockerfile.includes("yarn runtime:manifest") &&
    !dockerfile.includes("TRADEJS_PROJECT_SHA=unknown"),
  "Docker image does not contain an installed-package manifest",
);
assert(
  dockerfile.includes("COPY config ./config"),
  "Docker image does not include modular runtime config",
);

const entrypoint = read("entrypoint.sh");
assert(
  entrypoint.includes(
    "SIGNALS_DAEMON_DEPLOYMENT_ID:?SIGNALS_DAEMON_DEPLOYMENT_ID is required",
  ) &&
    entrypoint.includes(
      'parse_deployment_ids "$SIGNALS_DAEMON_DEPLOYMENT_ID"',
    ) &&
    entrypoint.includes('--deployment "$deployment_id"') &&
    !entrypoint.includes('SIGNALS_DAEMON_DEPLOYMENT_ID:-}" ]; then'),
  "Container entrypoint must require explicit deployment ids without a fallback",
);

const localCompose = read("docker-compose.dev.yml");
for (const volumeName of [
  "investing_pgdata",
  "investing_redisdata",
  "investing_pgadmin_data",
]) {
  assert(
    localCompose.includes(volumeName),
    `Local Compose does not preserve ${volumeName}`,
  );
}
assert(
  localCompose.includes("ghcr.io/tradejs-dev/tradejs-ml-infer:latest"),
  "Local Compose does not use the published ml-infer image",
);
assert(
  localCompose.includes("platform: ${ML_INFER_PLATFORM:-linux/amd64}"),
  "Local Compose does not declare the published ml-infer platform",
);
assert(
  (localCompose.match(/external: true/g) ?? []).length === 3,
  "Existing local volumes must remain explicitly external",
);
const mlInferService = localCompose.slice(
  localCompose.indexOf("  ml-infer:"),
  localCompose.indexOf("  pgadmin:"),
);
assert(!mlInferService.includes("build:"), "ml-infer must not build TradeJS");
assert(
  !mlInferService.includes("packages/ml"),
  "ml-infer must not mount TradeJS sources",
);
assert(
  dockerfile.includes("yarn build"),
  "Docker image does not build the app",
);
assert(
  dockerfile.includes("TradeJS-Dev/TradeJS-Project"),
  "Docker image source label has the wrong owner",
);

for (const relativePath of ["entrypoint.sh", "cronjob"]) {
  const contents = read(relativePath);
  assert(
    contents.includes("node_modules/.bin/tradejs"),
    `${relativePath} does not use the installed CLI package`,
  );
  assert(
    !contents.includes("bin/run-cli-runtime.sh"),
    `${relativePath} still depends on the TradeJS monorepo`,
  );
}

const workflow = read(".github/workflows/publish.yml");
assert(
  workflow.includes("workflow_dispatch:") && !/\non:\n\s+push:/.test(workflow),
  "Project publication must require an explicit workflow dispatch",
);
assert(
  workflow.includes("ghcr.io/tradejs-dev/tradejs-project-app"),
  "Project image name is missing",
);
assert(
  workflow.includes("tradejs-project-image-published"),
  "Deploy dispatch event is missing",
);
assert(
  workflow.includes("tradejs-project-app:${{ github.sha }}") &&
    !workflow.includes("tradejs-project-app:latest"),
  "Project app image must be published only under its commit SHA",
);
assert(
  workflow.includes("DEPLOY_REPOSITORY_TOKEN"),
  "Cross-repository dispatch token is not explicit",
);
assert(
  workflow.includes("DEPLOY_REPOSITORY_TOKEN || '').trim()") &&
    workflow.includes("TradeJS-Deploy/dispatches") &&
    workflow.includes("Deploy dispatch failed"),
  "Cross-repository dispatch must normalize the token and report API errors",
);
assert(
  workflow.includes("DEPLOY_REPOSITORY_TOKEN is required") &&
    !workflow.includes("if: env.DEPLOY_REPOSITORY_TOKEN != ''") &&
    !workflow.includes("Report disabled deploy dispatch"),
  "Project publication must fail before image push when Deploy handoff is unavailable",
);

const dependabot = read(".github/dependabot.yml");
assert(
  dependabot.includes('"@tradejs/strategy-*"') &&
    dependabot.includes('"@tradejs/node"'),
  "Dependabot must track strategy and runtime packages",
);

console.log(
  "Validated TradeJS-Project package, runtime image, and deploy handoff.",
);
