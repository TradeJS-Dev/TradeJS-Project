import assert from "node:assert/strict";
import test from "node:test";
import { resolveRuntimePackageComposition } from "./sync-runtime-package-composition.mjs";

const packageJson = {
  dependencies: {
    "@tradejs/core": "3.1.25",
    "@tradejs/node": "3.1.25",
    "@tradejs/base": "3.1.2",
    "@tradejs/strategy-double-tap": "3.0.3",
  },
};

const metadata =
  ({ sourceSha = "a".repeat(40), versions = {} } = {}) =>
  async (name, selector) => ({
    version:
      versions[`${name}@${selector}`] ??
      (selector === "latest" ? packageJson.dependencies[name] : selector),
    gitHead: sourceSha,
  });

test("resolves an exact beta framework cohort without moving stable packages", async () => {
  const result = await resolveRuntimePackageComposition({
    packageJson,
    frameworkVersion: "3.1.26-beta.242",
    getMetadata: metadata(),
  });

  assert.equal(
    result.packageJson.dependencies["@tradejs/core"],
    "3.1.26-beta.242",
  );
  assert.equal(
    result.packageJson.dependencies["@tradejs/node"],
    "3.1.26-beta.242",
  );
  assert.equal(result.packageJson.dependencies["@tradejs/base"], "3.1.2");
  assert.equal(result.frameworkSourceSha, "a".repeat(40));
});

test("rejects mixed source provenance inside a beta cohort", async () => {
  await assert.rejects(
    resolveRuntimePackageComposition({
      packageJson,
      frameworkVersion: "3.1.26-beta.242",
      getMetadata: async (name, selector) => ({
        version: selector,
        gitHead: name === "@tradejs/core" ? "a".repeat(40) : "b".repeat(40),
      }),
    }),
    /do not share one source gitHead/,
  );
});

test("weekly adjunct updates only host-provided packages from latest", async () => {
  const result = await resolveRuntimePackageComposition({
    packageJson,
    frameworkVersion: "3.1.26-beta.242",
    syncStablePackages: true,
    getMetadata: metadata({
      versions: {
        "@tradejs/base@latest": "3.1.3",
        "@tradejs/strategy-double-tap@latest": "3.0.4",
      },
    }),
  });

  assert.equal(result.packageJson.dependencies["@tradejs/base"], "3.1.3");
  assert.equal(
    result.packageJson.dependencies["@tradejs/strategy-double-tap"],
    "3.0.4",
  );
  assert.deepEqual(result.updatedStablePackages, [
    "@tradejs/base@3.1.3",
    "@tradejs/strategy-double-tap@3.0.4",
  ]);
});

test("rejects a stable version selected as the production framework channel", async () => {
  await assert.rejects(
    resolveRuntimePackageComposition({
      packageJson,
      frameworkVersion: "3.1.26",
      getMetadata: metadata(),
    }),
    /is not a beta/,
  );
});
