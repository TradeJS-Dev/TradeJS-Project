import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (relative) => {
  const filename = path.join(root, relative);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: (specifier) =>
      load(
        path.relative(
          root,
          path.resolve(path.dirname(filename), `${specifier}.ts`),
        ),
      ),
  });
  return exports;
};
const declaration = load(
  "config/runtime/strategies/range-reclaim.ts",
).rangeReclaimRuntime;

test("green forward authorization is limited to production at risk1 without AI", () => {
  const config = declaration.config;
  assert.equal(declaration.enabled, true);
  assert.equal(config.MAX_LOSS_VALUE, 1);
  assert.equal(config.AI_ENABLED, false);
  assert.equal(config.ML_ENABLED, false);
  assert.equal(config.RANGE_RECLAIM_ENTRY_POLICY, "intersection");
  const production = load(
    "config/runtime/deployments/production.ts",
  ).productionDeployment;
  const copy = load(
    "config/runtime/deployments/copy-trading.ts",
  ).copyTradingDeployment;
  assert.equal(production.accountId, "bybit-default");
  assert.ok(production.strategies.RangeReclaim);
  assert.equal(copy.strategies.RangeReclaim, undefined);
});

test("green keeps the frozen15m/4h lifecycle and does not include research execution transport", () => {
  const config = declaration.config;
  assert.equal(config.INTERVAL, "15");
  assert.equal(config.UNIVERSE, "crypto");
  assert.equal(config.RANGE_RECLAIM_RANGE_INTERVAL, "240");
  assert.equal(config.RANGE_RECLAIM_MAX_HOLD_BARS, 16);
  assert.equal(config.RANGE_RECLAIM_TARGET, "opposite");
  assert.equal(config.CLOSE_OPPOSITE_POSITIONS, false);
  for (const field of ["ENV", "MAKE_ORDERS", "JEV"])
    assert.equal(Object.hasOwn(config, field), false);
});

test("green instrument membership matches the authorized frozen USDT universe", () => {
  const tickers = Array.from(declaration.selection.tickers);
  assert.equal(tickers.length, 577);
  assert.equal(new Set(tickers).size, 577);
  assert.ok(tickers.every((ticker) => ticker.endsWith("USDT")));
  assert.equal(
    createHash("sha256").update(JSON.stringify(tickers)).digest("hex"),
    "387c1b95140e4164ff4ad7e0fac756077def51d07b711553109696e9da565cbf",
  );
});
