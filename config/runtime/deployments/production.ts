import type { RuntimeDeploymentDeclaration } from "@tradejs/types";
import { cupAndHandleRuntime } from "../strategies/cup-and-handle";
import { doubleTapRuntime } from "../strategies/double-tap";
import { dragonRuntime } from "../strategies/dragon";
import { flagRuntime } from "../strategies/flag";
import { headAndShouldersRuntime } from "../strategies/head-and-shoulders";
import { liquidityTailsRuntime } from "../strategies/liquidity-tails";
import { marketFlushReversalRuntime } from "../strategies/market-flush-reversal";
import { rangeReclaimRuntime } from "../strategies/range-reclaim";
import { relativeRotationRuntime } from "../strategies/relative-rotation";
import { structureZonesRuntime } from "../strategies/structure-zones";
import { trendFollowRuntime } from "../strategies/trend-follow";
import { trendShiftRuntime } from "../strategies/trend-shift";
import { tradingPatternsRuntime } from "../strategies/trading-patterns";
import { volumeDivergenceRuntime } from "../strategies/volume-divergence";

export const productionDeployment = {
  label: "Production",
  connectorName: "bybit",
  provider: "bybit",
  accountId: "bybit-default",
  enabled: true,
  strategies: {
    CupAndHandle: {
      ...cupAndHandleRuntime,
      config: { ...cupAndHandleRuntime.config, LEVERAGE: 20 },
    },
    DoubleTap: {
      ...doubleTapRuntime,
      config: { ...doubleTapRuntime.config, LEVERAGE: 20 },
    },
    Dragon: {
      ...dragonRuntime,
      config: { ...dragonRuntime.config, LEVERAGE: 20 },
    },
    Flag: {
      ...flagRuntime,
      config: { ...flagRuntime.config, LEVERAGE: 20 },
    },
    HeadAndShoulders: {
      ...headAndShouldersRuntime,
      config: { ...headAndShouldersRuntime.config, LEVERAGE: 20 },
    },
    LiquidityTails: {
      ...liquidityTailsRuntime,
      config: { ...liquidityTailsRuntime.config, LEVERAGE: 20 },
    },
    MarketFlushReversal: {
      ...marketFlushReversalRuntime,
      config: { ...marketFlushReversalRuntime.config, LEVERAGE: 20 },
    },
    RangeReclaim: {
      ...rangeReclaimRuntime,
      config: { ...rangeReclaimRuntime.config, LEVERAGE: 20 },
    },
    RelativeRotation: {
      ...relativeRotationRuntime,
      config: { ...relativeRotationRuntime.config, LEVERAGE: 20 },
    },
    StructureZones: {
      ...structureZonesRuntime,
      config: { ...structureZonesRuntime.config, LEVERAGE: 20 },
    },
    TrendShift: {
      ...trendShiftRuntime,
      config: { ...trendShiftRuntime.config, LEVERAGE: 20 },
    },
    TradingPatterns: {
      ...tradingPatternsRuntime,
      config: { ...tradingPatternsRuntime.config, LEVERAGE: 20 },
    },
    TrendFollow: {
      ...trendFollowRuntime,
      config: { ...trendFollowRuntime.config, LEVERAGE: 20 },
    },
    VolumeDivergence: {
      ...volumeDivergenceRuntime,
      config: { ...volumeDivergenceRuntime.config, LEVERAGE: 20 },
    },
  },
} satisfies RuntimeDeploymentDeclaration;
