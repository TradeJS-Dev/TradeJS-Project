import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) =>
  fs.readFileSync(path.join(root, ".github/workflows", name), "utf8");

test("production image publication verifies the exact committed composition", () => {
  const workflow = read("publish.yml");
  assert.doesNotMatch(workflow, /TRADEJS_ALLOW_PRERELEASE/);
  assert.match(workflow, /run: yarn checks/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\non:\n\s+push:/);
  assert.doesNotMatch(workflow, /environment:/);
  assert.match(workflow, /docker\/setup-buildx-action@v4/);
  assert.match(workflow, /docker\/login-action@v4/);
  assert.match(workflow, /docker\/build-push-action@v7/);
  assert.doesNotMatch(
    workflow,
    /docker\/(?:setup-buildx-action|login-action)@v3|docker\/build-push-action@v6/,
  );
  assert.match(workflow, /DEPLOY_REPOSITORY_TOKEN is required/);
  assert.match(workflow, /project_sha: process\.env\.PROJECT_SHA/);
  assert.doesNotMatch(
    workflow,
    /image_tag:|app_changed:|agent_changed:|ml_infer_changed:/,
  );
  assert.doesNotMatch(workflow, /Report disabled deploy dispatch/);
  assert.doesNotMatch(
    workflow,
    /if: env\.DEPLOY_REPOSITORY_TOKEN (?:==|!=) ''/,
  );
});

test("Project SHA does not invalidate the runner system layer", () => {
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  const runner = dockerfile.slice(
    dockerfile.indexOf("FROM node:24-alpine AS runner"),
  );

  assert.ok(
    runner.indexOf("RUN apk add") < runner.indexOf("ARG TRADEJS_PROJECT_SHA"),
  );
  assert.ok(
    runner.indexOf("ARG TRADEJS_PROJECT_SHA") <
      runner.indexOf("TRADEJS_PROJECT_SHA=${TRADEJS_PROJECT_SHA}"),
  );
});

test("verified beta sync is batched into one Project image", () => {
  const workflow = read("package-update.yml");
  const resolver = fs.readFileSync(
    path.join(root, "scripts/sync-runtime-package-composition.mjs"),
    "utf8",
  );
  assert.doesNotMatch(workflow, /environment: npm-production/);
  assert.match(workflow, /cron: "47 \* \* \* \*"/);
  assert.match(workflow, /cron: "0 6 \* \* 1"/);
  assert.match(workflow, /framework_version:/);
  assert.match(workflow, /sync_stable_packages:/);
  assert.match(workflow, /sync-runtime-package-composition\.mjs/);
  assert.match(resolver, /registry\.npmjs\.org/);
  assert.match(
    resolver,
    /Framework beta packages do not share one source gitHead/,
  );
  assert.match(resolver, /latest is not an exact stable version/);
  assert.doesNotMatch(workflow, /bump-runtime-strategy-versions\.mjs/);
  assert.match(workflow, /git diff --quiet -- package\.json/);
  assert.match(workflow, /yarn install --no-immutable/);
  assert.match(workflow, /run: yarn checks/);
  assert.match(workflow, /project-image-smoke\.sh/);
  assert.ok(
    workflow.indexOf("Create one local beta composition commit") <
      workflow.indexOf("project-image-smoke.sh"),
  );
  assert.ok(
    workflow.indexOf("project-image-smoke.sh") <
      workflow.indexOf("Push the verified beta composition"),
  );
  assert.match(workflow, /gh workflow run publish\.yml --ref main/);
  assert.doesNotMatch(workflow, /TRADEJS_ALLOW_PRERELEASE/);
  assert.doesNotMatch(workflow, /repository_dispatch/);
});

test("Project image smoke accepts exact release cohorts and is exchange-independent", () => {
  const smokePath = path.join(root, "scripts/project-image-smoke.sh");
  const smoke = fs.readFileSync(smokePath, "utf8");

  assert.match(smoke, /tradejs-app start/);
  assert.match(smoke, /saveTradingAccount/);
  assert.match(smoke, /closeRedisConnection/);
  assert.match(smoke, /--platform linux\/amd64/);
  assert.match(smoke, /runtime-control verify/);
  assert.ok(
    smoke.indexOf("saveTradingAccount") <
      smoke.indexOf("runtime-control verify"),
  );
  assert.match(smoke, /runtime-control pause/);
  assert.match(smoke, /runtime-control resume/);
  assert.doesNotMatch(smoke, /signals-daemon/);
  assert.doesNotMatch(smoke, /market-ws/);
  const invalidPrerelease = spawnSync(
    "bash",
    [
      smokePath,
      "tradejs-project:test",
      "@tradejs/node",
      "3.1.13-rc.1",
      "a".repeat(40),
    ],
    { encoding: "utf8" },
  );
  assert.equal(invalidPrerelease.status, 1);
  assert.match(
    invalidPrerelease.stderr,
    /Invalid exact stable or beta smoke version/,
  );
});
