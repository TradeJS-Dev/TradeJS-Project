import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const requiredFiles = [
  ".env.example",
  ".github/workflows/publish.yml",
  "Dockerfile",
  "cronjob",
  "deploy/runtime.env",
  "entrypoint.sh",
  "tradejs.config.ts",
];
for (const relativePath of requiredFiles) {
  assert(
    fs.existsSync(path.join(root, relativePath)),
    `Missing ${relativePath}`,
  );
}

const packageJson = JSON.parse(read("package.json"));
assert(packageJson.private === true, "TradeJS-Project must remain private");
assert(
  packageJson.dependencies["@tradejs/base"] === "^3.1.0",
  "TradeJS-Project must use the extracted non-empty @tradejs/base",
);
assert(
  !Object.hasOwn(packageJson.dependencies, "@tradejs/strategies"),
  "TradeJS-Project must not depend on the removed strategy monolith",
);
assert(
  packageJson.scripts.checks ===
    "yarn format:check && yarn validate && yarn build",
  "Unexpected checks contour",
);

const config = read("tradejs.config.ts");
assert(config.includes("defineConfig(basePreset)"), "basePreset is not active");

const runtimeEnv = read("deploy/runtime.env");
for (const secretName of [
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
  "AI_API_KEY",
  "AGENT_GITHUB_TOKEN",
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
  workflow.includes("DEPLOY_REPOSITORY_TOKEN"),
  "Cross-repository dispatch token is not explicit",
);

console.log(
  "Validated TradeJS-Project package, runtime image, and deploy handoff.",
);
