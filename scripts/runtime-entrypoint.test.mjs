import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
