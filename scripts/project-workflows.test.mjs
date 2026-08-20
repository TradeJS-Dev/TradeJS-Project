import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) =>
  fs.readFileSync(path.join(root, ".github/workflows", name), "utf8");

test("production image publication rejects prerelease dependencies", () => {
  const workflow = read("publish.yml");
  assert.doesNotMatch(workflow, /TRADEJS_ALLOW_PRERELEASE/);
  assert.match(workflow, /run: yarn checks/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\non:\n\s+push:/);
  assert.match(workflow, /environment: production/);
  assert.match(workflow, /DEPLOY_REPOSITORY_TOKEN is required/);
  assert.doesNotMatch(workflow, /Report disabled deploy dispatch/);
  assert.doesNotMatch(
    workflow,
    /if: env\.DEPLOY_REPOSITORY_TOKEN (?:==|!=) ''/,
  );
});

test("weekly stable package sync is batched into one Project image", () => {
  const workflow = read("package-update.yml");
  assert.doesNotMatch(workflow, /environment: npm-production/);
  assert.match(workflow, /cron: "0 6 \* \* 1"/);
  assert.match(workflow, /registry\.npmjs\.org/);
  assert.match(workflow, /latest is not a stable exact version/);
  assert.doesNotMatch(workflow, /bump-runtime-strategy-versions\.mjs/);
  assert.match(workflow, /git diff --quiet -- package\.json yarn\.lock/);
  assert.match(workflow, /yarn install --no-immutable/);
  assert.match(workflow, /run: yarn checks/);
  assert.match(workflow, /project-image-smoke\.sh/);
  assert.ok(
    workflow.indexOf("Create one local stable composition commit") <
      workflow.indexOf("project-image-smoke.sh"),
  );
  assert.ok(
    workflow.indexOf("project-image-smoke.sh") <
      workflow.indexOf("Push the verified stable composition"),
  );
  assert.match(workflow, /gh workflow run publish\.yml --ref main/);
  assert.doesNotMatch(workflow, /TRADEJS_ALLOW_PRERELEASE/);
  assert.doesNotMatch(workflow, /repository_dispatch/);
});

test("Project image smoke is stable and exchange-independent", () => {
  const smokePath = path.join(root, "scripts/project-image-smoke.sh");
  const smoke = fs.readFileSync(smokePath, "utf8");

  assert.match(smoke, /tradejs-app start/);
  assert.match(smoke, /runtime-control verify/);
  assert.match(smoke, /runtime-control pause/);
  assert.match(smoke, /runtime-control resume/);
  assert.doesNotMatch(smoke, /signals-daemon/);
  assert.doesNotMatch(smoke, /market-ws/);
  assert.doesNotMatch(smoke, /-beta/);

  const prerelease = spawnSync(
    "bash",
    [
      smokePath,
      "tradejs-project:test",
      "@tradejs/node",
      "3.1.13-beta.1",
      "a".repeat(40),
    ],
    { encoding: "utf8" },
  );
  assert.equal(prerelease.status, 1);
  assert.match(prerelease.stderr, /Invalid exact stable smoke version/);
});
