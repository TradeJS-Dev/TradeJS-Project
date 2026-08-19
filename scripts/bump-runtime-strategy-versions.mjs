import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHARED_RUNTIME_PACKAGES = new Set([
  "@tradejs/base",
  "@tradejs/cli",
  "@tradejs/connectors",
  "@tradejs/core",
  "@tradejs/indicators",
  "@tradejs/infra",
  "@tradejs/node",
  "@tradejs/strategy-kit",
  "@tradejs/types",
]);

const STRATEGY_PACKAGE_NAMES = new Map([
  ["@tradejs/strategy-adaptive-momentum-ribbon", ["AdaptiveMomentumRibbon"]],
  ["@tradejs/strategy-adaptive-trend-channel", ["AdaptiveTrendChannel"]],
  ["@tradejs/strategy-breakout", ["Breakout"]],
  ["@tradejs/strategy-cup-and-handle", ["CupAndHandle"]],
  ["@tradejs/strategy-double-tap", ["DoubleTap"]],
  ["@tradejs/strategy-grid", ["Grid"]],
  ["@tradejs/strategy-grid-classic", ["GridClassic"]],
  ["@tradejs/strategy-head-and-shoulders", ["HeadAndShoulders"]],
  ["@tradejs/strategy-hyperliquid-consensus", ["HyperliquidConsensus"]],
  ["@tradejs/strategy-liquidity-tails", ["LiquidityTails"]],
  ["@tradejs/strategy-liquidity-zones", ["LiquidityZones"]],
  ["@tradejs/strategy-ma-strategy", ["MaStrategy"]],
  ["@tradejs/strategy-market-flush-reversal", ["MarketFlushReversal"]],
  ["@tradejs/strategy-relative-rotation", ["RelativeRotation"]],
  ["@tradejs/strategy-structure-zones", ["StructureZones"]],
  ["@tradejs/strategy-trend-follow", ["TrendFollow"]],
  ["@tradejs/strategy-trend-line", ["TrendLine", "ReverseTrendLine"]],
  ["@tradejs/strategy-trend-shift", ["TrendShift"]],
  [
    "@tradejs/strategy-volatility-compression-breakout",
    ["VolatilityCompressionBreakout"],
  ],
  ["@tradejs/strategy-volume-divergence", ["VolumeDivergence"]],
]);

const declarationPattern =
  /^(\s+)([A-Za-z][A-Za-z0-9]*): \{\n(\s+)version: ([1-9][0-9]*),$/gm;

export const bumpRuntimeStrategyVersions = ({ source, changedPackages }) => {
  const declarations = [...source.matchAll(declarationPattern)].map(
    (match) => ({
      strategyName: match[2],
      version: Number(match[4]),
    }),
  );
  if (!declarations.length) {
    throw new Error("No runtime strategy declarations found");
  }

  const targets = new Set();
  if (changedPackages.some((name) => SHARED_RUNTIME_PACKAGES.has(name))) {
    for (const { strategyName } of declarations) targets.add(strategyName);
  }
  for (const packageName of changedPackages) {
    for (const strategyName of STRATEGY_PACKAGE_NAMES.get(packageName) ?? []) {
      if (declarations.some((item) => item.strategyName === strategyName)) {
        targets.add(strategyName);
      }
    }
  }

  const bumped = [];
  const nextSource = source.replace(
    declarationPattern,
    (match, indent, strategyName, versionIndent, versionText) => {
      if (!targets.has(strategyName)) return match;
      const previousVersion = Number(versionText);
      const version = previousVersion + 1;
      bumped.push({ strategyName, previousVersion, version });
      return `${indent}${strategyName}: {\n${versionIndent}version: ${version},`;
    },
  );
  return { source: nextSource, bumped };
};

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  const root = process.cwd();
  const changedPackages = process.argv.slice(2).filter(Boolean);
  if (!changedPackages.length) {
    throw new Error(
      "Usage: bump-runtime-strategy-versions.mjs <changed-package> [...]",
    );
  }
  const configPath = path.join(root, "tradejs.config.ts");
  const result = bumpRuntimeStrategyVersions({
    source: fs.readFileSync(configPath, "utf8"),
    changedPackages,
  });
  if (result.bumped.length) {
    fs.writeFileSync(configPath, result.source);
  }
  console.log(JSON.stringify(result.bumped));
}
