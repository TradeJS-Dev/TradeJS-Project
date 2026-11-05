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
const deployments = loadDeclaration("config/runtime/index.ts").runtime
  .deployments;

test("CopyTrading requests 20x for every strategy and retains risk 40", () => {
  const copy = deployments.CopyTrading;
  assert.equal(copy.accountId, "bybit-tradejs");
  assert.equal(Object.keys(copy.strategies).length, 4);
  for (const [name, strategy] of Object.entries(copy.strategies)) {
    assert.equal(strategy.config.LEVERAGE, 20, name);
    assert.equal(strategy.config.MAX_LOSS_VALUE, 40, name);
    const original = deployments.production.strategies[name];
    assert.deepEqual(
      structuredClone({
        ...strategy.config,
        MAX_LOSS_VALUE: original.config.MAX_LOSS_VALUE,
        LEVERAGE: original.config.LEVERAGE,
      }),
      structuredClone({
        ...original.config,
        LEVERAGE: original.config.LEVERAGE,
      }),
      name,
    );
  }
});

test("Production requests 20x and preserves every strategy setting and risk limit", () => {
  assert.equal(deployments.production.accountId, "bybit-default");
  assert.equal(Object.keys(deployments.production.strategies).length, 14);
  for (const [name, strategy] of Object.entries(
    deployments.production.strategies,
  )) {
    const filename = name.replace(
      /[A-Z]/g,
      (letter, index) => `${index ? "-" : ""}${letter.toLowerCase()}`,
    );
    const exportName = `${name[0].toLowerCase()}${name.slice(1)}Runtime`;
    const original = loadDeclaration(
      `config/runtime/strategies/${filename}.ts`,
    )[exportName];
    assert.equal(strategy.config.LEVERAGE, 20, name);
    assert.deepEqual(
      structuredClone(strategy),
      structuredClone({
        ...original,
        config: { ...original.config, LEVERAGE: 20 },
      }),
      name,
    );
  }
});
