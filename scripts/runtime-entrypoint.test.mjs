import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("entrypoint rejects a missing runtime deployment before starting processes", () => {
  const env = { ...process.env };
  delete env.SIGNALS_DAEMON_DEPLOYMENT_ID;
  const result = spawnSync("bash", ["entrypoint.sh"], {
    cwd: root,
    env,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /SIGNALS_DAEMON_DEPLOYMENT_ID is required/);
  assert.doesNotMatch(result.stdout, /Starting signals-daemon/);
});

test("entrypoint supports comma-separated runtime deployments", () => {
  const source = fs.readFileSync(path.join(root, "entrypoint.sh"), "utf8");

  assert.ok(source.includes("IFS=',' read -r -a values <<<\"$raw\""));
  assert.ok(
    source.includes(
      'done < <(parse_deployment_ids "$SIGNALS_DAEMON_DEPLOYMENT_ID")',
    ),
  );
  assert.ok(source.includes('--deployment "$deployment_id"'));
});
