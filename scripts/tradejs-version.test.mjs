import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertExactTradejsVersion,
  setTradejsFrameworkVersion,
  setTradejsPackageVersions,
  TRADEJS_FRAMEWORK_PACKAGES,
} from "./tradejs-version.mjs";

test("stable validation rejects prerelease dependencies by default", () => {
  assert.throws(
    () => assertExactTradejsVersion("@tradejs/node", "3.1.8-beta.42"),
    /exact stable version/,
  );
  assert.doesNotThrow(() =>
    assertExactTradejsVersion("@tradejs/node", "3.1.8-beta.42", {
      allowPrerelease: true,
    }),
  );
});

test("targeted updates change only the selected installed package", (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "tradejs-project-package-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      dependencies: {
        "@tradejs/node": "3.1.7",
        "@tradejs/strategy-double-tap": "3.0.0",
      },
    }),
  );

  const packageJson = setTradejsPackageVersions({
    root,
    packageNames: ["@tradejs/strategy-double-tap"],
    version: "3.0.1-beta.8",
  });

  assert.equal(packageJson.dependencies["@tradejs/node"], "3.1.7");
  assert.equal(
    packageJson.dependencies["@tradejs/strategy-double-tap"],
    "3.0.1-beta.8",
  );
});

test("beta staging updates framework packages without changing strategies", (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "tradejs-project-version-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dependencies = Object.fromEntries(
    TRADEJS_FRAMEWORK_PACKAGES.map((name) => [name, "3.1.7"]),
  );
  dependencies["@tradejs/base"] = "3.1.0";
  dependencies["@tradejs/strategy-double-tap"] = "3.0.0";
  fs.writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ private: true, dependencies }, null, 2)}\n`,
  );

  const packageJson = setTradejsFrameworkVersion({
    root,
    version: "3.1.8-beta.42",
  });

  for (const name of TRADEJS_FRAMEWORK_PACKAGES) {
    assert.equal(packageJson.dependencies[name], "3.1.8-beta.42");
  }
  assert.equal(packageJson.dependencies["@tradejs/base"], "3.1.0");
  assert.equal(
    packageJson.dependencies["@tradejs/strategy-double-tap"],
    "3.0.0",
  );
});
