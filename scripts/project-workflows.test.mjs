import assert from "node:assert/strict";
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
});

test("weekly stable package sync is batched into one Project image", () => {
  const workflow = read("package-update.yml");
  assert.match(workflow, /cron: "0 6 \* \* 1"/);
  assert.match(workflow, /registry\.npmjs\.org/);
  assert.match(workflow, /latest is not a stable exact version/);
  assert.match(workflow, /bump-runtime-strategy-versions\.mjs/);
  assert.match(workflow, /package\.json yarn\.lock tradejs\.config\.ts/);
  assert.match(workflow, /yarn install --no-immutable/);
  assert.match(workflow, /run: yarn checks/);
  assert.match(workflow, /beta-runtime-smoke\.sh/);
  assert.ok(
    workflow.indexOf("Create one local stable composition commit") <
      workflow.indexOf("beta-runtime-smoke.sh"),
  );
  assert.ok(
    workflow.indexOf("beta-runtime-smoke.sh") <
      workflow.indexOf("Push the verified stable composition"),
  );
  assert.match(workflow, /gh workflow run publish\.yml --ref main/);
  assert.doesNotMatch(workflow, /TRADEJS_ALLOW_PRERELEASE/);
  assert.doesNotMatch(workflow, /repository_dispatch/);
});
