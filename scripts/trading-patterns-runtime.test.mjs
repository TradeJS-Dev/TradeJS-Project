import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadDeclaration = (relativePath) => {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (specifier) =>
      loadDeclaration(
        path.relative(
          root,
          path.resolve(path.dirname(filename), `${specifier}.ts`),
        ),
      ),
  });
  return exports;
};
const declaration = loadDeclaration(
  "config/runtime/strategies/trading-patterns.ts",
).tradingPatternsRuntime;

test("variant E runs both directions at risk 1 on hourly bars", () => {
  assert.equal(declaration.enabled, true);
  assert.equal(declaration.config.INTERVAL, "60");
  assert.equal(declaration.config.MAX_LOSS_VALUE, 1);
  assert.equal(declaration.config.LONG.enable, true);
  assert.equal(declaration.config.SHORT.enable, true);
  assert.equal(declaration.config.AI_ENABLED, true);
  assert.equal(declaration.config.AI_MODE, "gate");
  assert.equal(declaration.config.MIN_AI_QUALITY, 4);
  assert.equal(declaration.config.FLAG_MAX_BREAKOUT_DISTANCE_ATR_SHORT, 0.75);
  assert.equal(declaration.config.FLAG_MAX_BREAKOUT_DISTANCE_ATR, 1.5);
});

test("only the four retained detectors are enabled in their frozen priority", () => {
  const names = ["Diamond", "Flag", "Gartley", "HeadAndShoulders"];
  assert.deepEqual(
    Array.from(declaration.config.TRADING_PATTERNS_PRIORITY),
    names,
  );
  assert.deepEqual(Object.keys(declaration.config.TRADING_PATTERNS), names);
  for (const child of Object.values(declaration.config.TRADING_PATTERNS)) {
    assert.equal(child.enable, true);
  }
  assert.equal(
    declaration.config.TRADING_PATTERNS.Flag.SHORT.minRiskRatio,
    0.5,
  );
});

test("the instrument binding is frozen and research transport is not production config", () => {
  const tickers = Array.from(declaration.selection.tickers);
  assert.equal(tickers.length, 560);
  assert.equal(new Set(tickers).size, 560);
  assert.deepEqual(tickers, [...tickers].sort());
  for (const key of ["JEV", "ENV", "MAKE_ORDERS"]) {
    assert.equal(Object.hasOwn(declaration.config, key), false);
  }
});
