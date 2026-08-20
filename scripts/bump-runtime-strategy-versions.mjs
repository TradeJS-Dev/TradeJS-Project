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

const RUNTIME_STRATEGY_FILES = new Map([
  ["DoubleTap", "config/runtime/strategies/double-tap.ts"],
  ["TrendFollow", "config/runtime/strategies/trend-follow.ts"],
  ["TrendShift", "config/runtime/strategies/trend-shift.ts"],
]);

const VERSION_PATTERN = /^(\s*)version: ([1-9][0-9]*),$/m;

const resolveTargets = ({ changedPackages, strategyNames }) => {
  const declared = new Set(strategyNames);
  const targets = new Set();

  if (changedPackages.some((name) => SHARED_RUNTIME_PACKAGES.has(name))) {
    for (const strategyName of declared) targets.add(strategyName);
  }

  for (const packageName of changedPackages) {
    for (const strategyName of STRATEGY_PACKAGE_NAMES.get(packageName) ?? []) {
      if (declared.has(strategyName)) targets.add(strategyName);
    }
  }

  return targets;
};

export const bumpRuntimeStrategyVersions = ({ sources, changedPackages }) => {
  const targets = resolveTargets({
    changedPackages,
    strategyNames: Object.keys(sources),
  });
  const nextSources = { ...sources };
  const bumped = [];

  for (const strategyName of [...targets].sort()) {
    const source = sources[strategyName];
    if (typeof source !== "string") continue;
    const match = VERSION_PATTERN.exec(source);
    if (!match) {
      throw new Error(`No runtime version found for ${strategyName}`);
    }

    const previousVersion = Number(match[2]);
    const version = previousVersion + 1;
    nextSources[strategyName] = source.replace(
      VERSION_PATTERN,
      `$1version: ${version},`,
    );
    bumped.push({ strategyName, previousVersion, version });
  }

  return { sources: nextSources, bumped };
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

  const sources = Object.fromEntries(
    [...RUNTIME_STRATEGY_FILES].map(([strategyName, relativePath]) => [
      strategyName,
      fs.readFileSync(path.join(root, relativePath), "utf8"),
    ]),
  );
  const result = bumpRuntimeStrategyVersions({ sources, changedPackages });

  for (const { strategyName } of result.bumped) {
    const relativePath = RUNTIME_STRATEGY_FILES.get(strategyName);
    fs.writeFileSync(
      path.join(root, relativePath),
      result.sources[strategyName],
    );
  }

  console.log(JSON.stringify(result.bumped));
}
