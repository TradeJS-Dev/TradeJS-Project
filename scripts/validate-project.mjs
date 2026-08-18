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
  ".codex/skills/strategy-release/SKILL.md",
  "Dockerfile",
  "cronjob",
  "deploy/runtime.env",
  "docker-compose.dev.yml",
  "entrypoint.sh",
  "scripts/research-notes-check.mjs",
  "scripts/runtime-entrypoint.test.mjs",
  "scripts/project-workflows.test.mjs",
  "scripts/set-tradejs-version.mjs",
  "scripts/set-tradejs-package-version.mjs",
  "scripts/beta-runtime-smoke.sh",
  "scripts/fixtures/doubletap-smoke-v1.json",
  "scripts/fixtures/doubletap-smoke-v2.json",
  "scripts/tradejs-version.mjs",
  "scripts/tradejs-version.test.mjs",
  "scripts/write-runtime-package-manifest.mjs",
  "scripts/runtime-package-manifest.test.mjs",
  "tradejs.config.ts",
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
  assertExactTradejsVersion(name, version, {
    allowPrerelease: process.env.TRADEJS_ALLOW_PRERELEASE === "true",
  });
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
    "yarn format:check && yarn validate && yarn test && yarn notes:check && NODE_ENV=production yarn build",
  "Unexpected checks contour",
);
for (const scriptName of [
  "backtest",
  "replay",
  "ai-export",
  "ai-pocket-search",
  "ai-train",
  "research:auto",
  "research:core",
  "runtime-config",
  "runtime:manifest",
  "notes:check",
]) {
  assert(packageJson.scripts[scriptName], `Missing ${scriptName} script`);
}

const config = read("tradejs.config.ts");
assert(config.includes("defineConfig(basePreset)"), "basePreset is not active");

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

const strategyReleaseSkill = read(".codex/skills/strategy-release/SKILL.md");
assert(
  strategyReleaseSkill.includes("/Users/aleksnick/dev/tradejs/tradejs-project"),
  "strategy-release skill must run from TradeJS-Project",
);
assert(
  strategyReleaseSkill.includes("PROJECT_CWD") &&
    strategyReleaseSkill.includes("TRADEJS_SOURCE_REPOSITORY_ROOT"),
  "strategy-release skill must separate project and source roots",
);
assert(
  strategyReleaseSkill.includes("runtime-config provision") &&
    !strategyReleaseSkill.includes("runtime-config bootstrap") &&
    !strategyReleaseSkill.includes("runtime-config migrate"),
  "strategy-release skill must use only canonical runtime config commands",
);
assert(
  strategyReleaseSkill.includes(
    "commit and push every strategy-owned source/gate change",
  ) &&
    strategyReleaseSkill.includes(
      "production-like Project smoke to move the npm `beta` tag",
    ) &&
    strategyReleaseSkill.includes("weekly Project sync to batch") &&
    strategyReleaseSkill.includes("matching Project\n  publish workflow") &&
    strategyReleaseSkill.includes("runtime-config rollout"),
  "strategy-release skill must preserve the complete forward-test rollout handshake",
);

const runtimeEnv = read("deploy/runtime.env");
assert(
  runtimeEnv.includes("SIGNALS_DAEMON_DEPLOYMENT_ID=doubletap-forward"),
  "Production signals daemon must select the canonical deployment explicitly",
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
    dockerfile.includes("yarn runtime:manifest"),
  "Docker image does not contain an installed-package manifest",
);

const entrypoint = read("entrypoint.sh");
assert(
  entrypoint.includes(
    "SIGNALS_DAEMON_DEPLOYMENT_ID:?SIGNALS_DAEMON_DEPLOYMENT_ID is required",
  ) &&
    entrypoint.includes('--deployment "$SIGNALS_DAEMON_DEPLOYMENT_ID"') &&
    !entrypoint.includes('SIGNALS_DAEMON_DEPLOYMENT_ID:-}" ]; then'),
  "Container entrypoint must require the canonical deployment without a fallback",
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
  workflow.includes("if: env.DEPLOY_REPOSITORY_TOKEN != ''"),
  "Project bootstrap must skip deploy dispatch until its token exists",
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
