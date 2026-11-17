import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("local data service publications are loopback-only", () => {
  const source = fs.readFileSync(
    new URL("../docker-compose.dev.yml", import.meta.url),
    "utf8",
  );
  const publications = [...source.matchAll(/^\s+- "([^"]+):([0-9]+)"$/gm)].map(
    (match) => match[1],
  );
  assert.equal(publications.length, 5);
  assert.ok(publications.every((port) => port.startsWith("127.0.0.1:")));
});

test("profile refresh is scoped to the production child rather than blocking the app", () => {
  const source = fs.readFileSync(
    new URL("../entrypoint.sh", import.meta.url),
    "utf8",
  );
  const child = source.slice(
    source.indexOf("start_signals_daemon()"),
    source.indexOf("shutdown()"),
  );
  assert.match(
    child,
    /until PROJECT_CWD=\/app timeout 120 node .* refresh; do/,
  );
  assert.match(child, /sleep 60/);
  const startup = source.slice(source.indexOf('touch "$SIGNALS_LOG_PATH"'));
  assert.doesNotMatch(startup, /ticker-profiles/);
  assert.match(startup, /tradejs-app start/);
});

test("a failed profile refresh retries without blocking independent application startup", (context) => {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "project-startup-fixture-"),
  );
  context.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "node_modules/.bin"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "node_modules/.bin/tradejs"),
    '#!/bin/sh\n[ -f app-started ] || exit 42\nprintf "%s\\n" "$*" > signals-started\n',
  );
  fs.chmodSync(path.join(dir, "node_modules/.bin/tradejs"), 0o755);
  const source = fs.readFileSync(
    new URL("../entrypoint.sh", import.meta.url),
    "utf8",
  );
  const definitions = source.slice(0, source.indexOf("shutdown()"));
  const script =
    definitions +
    `
append_bool_flag() { :; }
timeout() { if [ ! -f attempted ]; then touch attempted; return 1; fi; touch refreshed; return 0; }
sleep() { while [ ! -f app-started ]; do /bin/sleep 0.01; done; }
start_signals_daemon production
touch app-started
wait "$signals_pid"
test -f refreshed && test -f signals-started
`;
  // signals_pid is local to the production function; managed_pids owns the child.
  const result = spawnSync(
    "bash",
    ["-c", script.replace('wait "$signals_pid"', 'wait "${managed_pids[0]}"')],
    {
      cwd: dir,
      env: {
        ...process.env,
        SIGNALS_DAEMON_DEPLOYMENT_ID: "production",
        SIGNALS_LOG_PATH: path.join(dir, "signals.log"),
      },
      encoding: "utf8",
      timeout: 5000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    fs.readFileSync(path.join(dir, "signals-started"), "utf8"),
    /signals-daemon --deployment production/,
  );
});
