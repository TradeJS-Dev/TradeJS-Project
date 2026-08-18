import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildRuntimePackageManifest } from "./write-runtime-package-manifest.mjs";

const makeFixture = ({
  declaredNodeVersion = "3.1.4",
  installedNodeVersion = "3.1.4",
} = {}) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "tradejs-project-manifest-"),
  );
  fs.mkdirSync(path.join(root, "node_modules/@tradejs/node"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(root, "node_modules/@tradejs/strategy-double-tap"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      dependencies: {
        "@tradejs/node": declaredNodeVersion,
        "@tradejs/strategy-double-tap": "3.0.0",
        dotenv: "^16.0.0",
      },
    }),
  );
  fs.writeFileSync(
    path.join(root, "node_modules/@tradejs/node/package.json"),
    JSON.stringify({ version: installedNodeVersion }),
  );
  fs.writeFileSync(
    path.join(root, "node_modules/@tradejs/strategy-double-tap/package.json"),
    JSON.stringify({ version: "3.0.0" }),
  );
  return root;
};

test("records only exact installed TradeJS package versions and project SHA", (t) => {
  const root = makeFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.deepEqual(
    buildRuntimePackageManifest({ root, projectSha: "a".repeat(40) }),
    {
      schema: "tradejs-runtime-package-manifest/v1",
      projectSha: "a".repeat(40),
      packages: {
        "@tradejs/node": "3.1.4",
        "@tradejs/strategy-double-tap": "3.0.0",
      },
    },
  );
});

test("rejects a container install that differs from package.json", (t) => {
  const root = makeFixture({ installedNodeVersion: "3.1.3" });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => buildRuntimePackageManifest({ root, allowPrerelease: false }),
    /package\.json=3\.1\.4 installed=3\.1\.3/,
  );
});

test("rejects non-exact TradeJS dependency versions", (t) => {
  const root = makeFixture({ declaredNodeVersion: "^3.1.4" });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => buildRuntimePackageManifest({ root, allowPrerelease: false }),
    /@tradejs\/node must use an exact stable version/,
  );
});

test("records an exact beta only when prerelease staging is explicit", (t) => {
  const version = "3.1.8-beta.42";
  const root = makeFixture({
    declaredNodeVersion: version,
    installedNodeVersion: version,
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => buildRuntimePackageManifest({ root, allowPrerelease: false }),
    /@tradejs\/node must use an exact stable version/,
  );
  assert.equal(
    buildRuntimePackageManifest({ root, allowPrerelease: true }).packages[
      "@tradejs/node"
    ],
    version,
  );
});
