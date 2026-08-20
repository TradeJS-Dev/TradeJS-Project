import assert from "node:assert/strict";
import test from "node:test";
import { bumpRuntimeStrategyVersions } from "./bump-runtime-strategy-versions.mjs";

const sources = {
  DoubleTap: `export const doubleTapRuntime = {
  version: 4,
  enabled: true,
};`,
  TrendShift: `export const trendShiftRuntime = {
  version: 2,
  enabled: true,
};`,
};

test("bumps only the declared strategy whose package changed", () => {
  const result = bumpRuntimeStrategyVersions({
    sources,
    changedPackages: ["@tradejs/strategy-double-tap"],
  });

  assert.match(result.sources.DoubleTap, /version: 5,/);
  assert.match(result.sources.TrendShift, /version: 2,/);
  assert.deepEqual(result.bumped, [
    { strategyName: "DoubleTap", previousVersion: 4, version: 5 },
  ]);
});

test("bumps every declared strategy after a shared runtime change", () => {
  const result = bumpRuntimeStrategyVersions({
    sources,
    changedPackages: ["@tradejs/node"],
  });

  assert.match(result.sources.DoubleTap, /version: 5,/);
  assert.match(result.sources.TrendShift, /version: 3,/);
  assert.equal(result.bumped.length, 2);
});

test("does not bump runtime versions for an app-only update", () => {
  const result = bumpRuntimeStrategyVersions({
    sources,
    changedPackages: ["@tradejs/app"],
  });

  assert.deepEqual(result.sources, sources);
  assert.deepEqual(result.bumped, []);
});
