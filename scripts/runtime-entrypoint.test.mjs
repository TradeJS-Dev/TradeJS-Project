import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("runtime evidence cron restores immutable image identity", (context) => {
  const tempDirectory = fs.mkdtempSync(
    path.join(process.env.TMPDIR ?? "/tmp", "tradejs-cron-identity-"),
  );
  context.after(() => fs.rmSync(tempDirectory, { recursive: true }));

  const projectSha = "a".repeat(40);
  const imageDigest = `sha256:${"b".repeat(64)}`;
  const identityPath = path.join(tempDirectory, "runtime-identity.env");
  const writerPath = path.join(
    root,
    "scripts",
    "write-runtime-cron-identity.sh",
  );
  const writeResult = spawnSync("bash", [writerPath, identityPath], {
    cwd: root,
    env: {
      ...process.env,
      SIGNALS_DAEMON_DEPLOYMENT_ID: "production,CopyTrading",
      TRADEJS_PROJECT_SHA: projectSha,
      TRADEJS_PROJECT_IMAGE_DIGEST: imageDigest,
    },
    encoding: "utf8",
  });

  assert.equal(writeResult.status, 0, writeResult.stderr);
  const cronChild = spawnSync(
    "env",
    [
      "-i",
      `PATH=${process.env.PATH}`,
      "sh",
      "-c",
      '. "$1" && test "$TRADEJS_PROJECT_SHA" = "$2" && test "$TRADEJS_PROJECT_IMAGE_DIGEST" = "$3" && test "$RUNTIME_EVIDENCE_DEPLOYMENT_ID" = "production,CopyTrading"',
      "runtime-evidence-cron",
      identityPath,
      projectSha,
      imageDigest,
    ],
    { encoding: "utf8" },
  );

  assert.equal(cronChild.status, 0, cronChild.stderr);

  const cronjob = fs.readFileSync(path.join(root, "cronjob"), "utf8");
  const entrypoint = fs.readFileSync(path.join(root, "entrypoint.sh"), "utf8");
  assert.match(cronjob, /runtime-evidence-daily\.sh/);
  assert.ok(
    entrypoint.indexOf("./scripts/write-runtime-cron-identity.sh") <
      entrypoint.indexOf("crond -f -P"),
  );
});

test("production cron leaves parity notification to verified runtime feedback", () => {
  const cronjob = fs.readFileSync(path.join(root, "cronjob"), "utf8");

  assert.doesNotMatch(cronjob, /runtime-parity[^\n]*--notify/);
  assert.match(cronjob, /runtime-evidence-daily\.sh/);
});

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

test("evidence cron runs each deployment and preserves failures", (context) => {
  const dir = fs.mkdtempSync(
    path.join(process.env.TMPDIR ?? "/tmp", "evidence-cron-"),
  );
  context.after(() => fs.rmSync(dir, { recursive: true }));
  const identity = path.join(dir, "identity");
  fs.writeFileSync(
    identity,
    "export RUNTIME_EVIDENCE_DEPLOYMENT_ID=production,CopyTrading\n",
  );
  const calls = path.join(dir, "calls");
  const cli = path.join(dir, "cli");
  fs.writeFileSync(
    cli,
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$CALLS"\ncase "$*" in *"--deployment production "*) exit 1;; esac\n',
  );
  fs.chmodSync(cli, 0o755);
  const script = path.join(dir, "daily.sh");
  fs.writeFileSync(
    script,
    fs
      .readFileSync(
        path.join(root, "scripts/runtime-evidence-daily.sh"),
        "utf8",
      )
      .replace("/run/tradejs/runtime-cron-identity.env", identity)
      .replace("cd /app", `cd "${dir}"`)
      .replace("./node_modules/.bin/tradejs", `"${cli}"`),
  );
  const result = spawnSync("bash", [script], {
    env: { ...process.env, CALLS: calls },
    encoding: "utf8",
  });
  assert.equal(result.status, 1, result.stderr);
  const lines = fs.readFileSync(calls, "utf8").trim().split("\n");
  assert.equal(lines.length, 2);
  assert.match(
    lines[0],
    /--deployment production --out .*latest\/production\//,
  );
  assert.match(
    lines[1],
    /--deployment CopyTrading --out .*latest\/CopyTrading\//,
  );
  assert.ok(lines.every((line) => !line.includes("production,CopyTrading")));
});

test("production evidence targets are explicit and independent from the daemon fallback", () => {
  const runtimeEnv = fs.readFileSync(
    path.join(root, "deploy/runtime.env"),
    "utf8",
  );
  assert.match(
    runtimeEnv,
    /^RUNTIME_EVIDENCE_DEPLOYMENT_ID=production,CopyTrading$/m,
  );
});
