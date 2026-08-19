import assert from "node:assert/strict";
import test from "node:test";
import { bumpRuntimeStrategyVersions } from "./bump-runtime-strategy-versions.mjs";

const source = `strategies: {
  DoubleTap: {
    version: 4,
    enabled: true,
  },
  TrendShift: {
    version: 2,
    enabled: true,
  },
}`;

test("bumps only the declared strategy whose package changed", () => {
  const result = bumpRuntimeStrategyVersions({
    source,
    changedPackages: ["@tradejs/strategy-double-tap"],
  });

  assert.match(result.source, /DoubleTap: \{\n    version: 5,/);
  assert.match(result.source, /TrendShift: \{\n    version: 2,/);
  assert.deepEqual(result.bumped, [
    { strategyName: "DoubleTap", previousVersion: 4, version: 5 },
  ]);
});

test("bumps every declared strategy after a shared runtime change", () => {
  const result = bumpRuntimeStrategyVersions({
    source,
    changedPackages: ["@tradejs/node"],
  });

  assert.match(result.source, /DoubleTap: \{\n    version: 5,/);
  assert.match(result.source, /TrendShift: \{\n    version: 3,/);
  assert.equal(result.bumped.length, 2);
});

test("does not bump runtime versions for an app-only update", () => {
  const result = bumpRuntimeStrategyVersions({
    source,
    changedPackages: ["@tradejs/app"],
  });

  assert.equal(result.source, source);
  assert.deepEqual(result.bumped, []);
});
