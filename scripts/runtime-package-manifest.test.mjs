import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildRuntimePackageManifest } from "./write-runtime-package-manifest.mjs";

const makeFixture = ({
  declaredNodeVersion = "3.1.4",
  installedNodeVersion = "3.1.4",
  strategyKitPeerRange = "^3.0.0",
  strategyRuntimeDependency = false,
  additionalEngineVersion,
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
  fs.mkdirSync(path.join(root, "node_modules/@tradejs/strategy-kit"), {
    recursive: true,
  });
  if (additionalEngineVersion) {
    fs.mkdirSync(path.join(root, "node_modules/@tradejs/core"), {
      recursive: true,
    });
  }
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      dependencies: {
        "@tradejs/node": declaredNodeVersion,
        ...(additionalEngineVersion
          ? { "@tradejs/core": additionalEngineVersion }
          : {}),
        "@tradejs/strategy-double-tap": "3.0.0",
        dotenv: "^16.0.0",
      },
    }),
  );
  fs.writeFileSync(
    path.join(root, "node_modules/@tradejs/node/package.json"),
    JSON.stringify({ name: "@tradejs/node", version: installedNodeVersion }),
  );
  if (additionalEngineVersion) {
    fs.writeFileSync(
      path.join(root, "node_modules/@tradejs/core/package.json"),
      JSON.stringify({
        name: "@tradejs/core",
        version: additionalEngineVersion,
      }),
    );
  }
  fs.writeFileSync(
    path.join(root, "node_modules/@tradejs/strategy-double-tap/package.json"),
    JSON.stringify({
      name: "@tradejs/strategy-double-tap",
      version: "3.0.0",
      ...(strategyRuntimeDependency
        ? { dependencies: { "@tradejs/strategy-kit": strategyKitPeerRange } }
        : {
            peerDependencies: { "@tradejs/strategy-kit": strategyKitPeerRange },
          }),
    }),
  );
  fs.writeFileSync(
    path.join(root, "node_modules/@tradejs/strategy-kit/package.json"),
    JSON.stringify({ name: "@tradejs/strategy-kit", version: "3.0.1" }),
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
        "@tradejs/strategy-kit": "3.0.1",
      },
    },
  );
});

test("rejects an invalid Project SHA", (t) => {
  const root = makeFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => buildRuntimePackageManifest({ root, projectSha: "main" }),
    /Invalid Project SHA: main/,
  );
});

test("rejects a container install that differs from package.json", (t) => {
  const root = makeFixture({ installedNodeVersion: "3.1.3" });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () =>
      buildRuntimePackageManifest({
        root,
        projectSha: "a".repeat(40),
      }),
    /package\.json=3\.1\.4 installed=3\.1\.3/,
  );
});

test("rejects non-exact TradeJS dependency versions", (t) => {
  const root = makeFixture({ declaredNodeVersion: "^3.1.4" });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () =>
      buildRuntimePackageManifest({
        root,
        projectSha: "a".repeat(40),
      }),
    /@tradejs\/node must use an exact stable version/,
  );
});

test("rejects prerelease packages in every Project composition", (t) => {
  const version = "3.1.8-beta.42";
  const root = makeFixture({
    declaredNodeVersion: version,
    installedNodeVersion: version,
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () =>
      buildRuntimePackageManifest({
        root,
        projectSha: "a".repeat(40),
      }),
    /@tradejs\/node must use an exact stable version/,
  );
});

test("rejects a mixed engine package release", (t) => {
  const root = makeFixture({ additionalEngineVersion: "3.1.5" });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => buildRuntimePackageManifest({ root, projectSha: "a".repeat(40) }),
    /Engine package family must use one version: @tradejs\/core@3\.1\.5, @tradejs\/node@3\.1\.4/,
  );
});

test("rejects a host version outside a package peer range", (t) => {
  const root = makeFixture({ strategyKitPeerRange: "^4.0.0" });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => buildRuntimePackageManifest({ root, projectSha: "a".repeat(40) }),
    /@tradejs\/strategy-double-tap requires @tradejs\/strategy-kit@\^4\.0\.0 but host installed 3\.0\.1/,
  );
});

test("rejects a strategy that packages a second TradeJS runtime", (t) => {
  const root = makeFixture({ strategyRuntimeDependency: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => buildRuntimePackageManifest({ root, projectSha: "a".repeat(40) }),
    /@tradejs\/strategy-double-tap must use host-provided TradeJS peers/,
  );
});

test("rejects an unresolved Project SHA instead of writing unknown", (t) => {
  const root = makeFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  assert.throws(
    () => buildRuntimePackageManifest({ root }),
    /Unable to resolve Project SHA/,
  );
});
