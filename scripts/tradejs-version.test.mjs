import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProjectTradejsVersion,
  resolveFrameworkPackageRelease,
} from "./tradejs-version.mjs";

test("framework dependencies may use only exact stable or beta versions", () => {
  assert.doesNotThrow(() =>
    assertProjectTradejsVersion("@tradejs/node", "3.1.8"),
  );
  assert.doesNotThrow(() =>
    assertProjectTradejsVersion("@tradejs/node", "3.1.9-beta.42"),
  );
  assert.throws(
    () => assertProjectTradejsVersion("@tradejs/node", "3.1.9-rc.1"),
    /exact stable or beta version/,
  );
  assert.throws(
    () => assertProjectTradejsVersion("@tradejs/node", "^3.1.8"),
    /exact stable or beta version/,
  );
});

test("host-provided packages remain stable-only", () => {
  assert.doesNotThrow(() =>
    assertProjectTradejsVersion("@tradejs/strategy-double-tap", "3.0.3"),
  );
  assert.throws(
    () =>
      assertProjectTradejsVersion(
        "@tradejs/strategy-double-tap",
        "3.0.4-beta.1",
      ),
    /exact stable version/,
  );
});

test("framework release identity is one complete cohort", () => {
  assert.deepEqual(
    resolveFrameworkPackageRelease({
      "@tradejs/core": "3.1.9-beta.42",
      "@tradejs/node": "3.1.9-beta.42",
    }),
    {
      releaseChannel: "beta",
      frameworkVersion: "3.1.9-beta.42",
    },
  );
  assert.throws(
    () =>
      resolveFrameworkPackageRelease({
        "@tradejs/core": "3.1.9-beta.42",
        "@tradejs/node": "3.1.8",
      }),
    /Framework package family must use one version/,
  );
});
