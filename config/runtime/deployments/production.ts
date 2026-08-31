import type { RuntimeDeploymentDeclaration } from "@tradejs/types";
import { cupAndHandleRuntime } from "../strategies/cup-and-handle";
import { doubleTapRuntime } from "../strategies/double-tap";
import { dragonRuntime } from "../strategies/dragon";
import { headAndShouldersRuntime } from "../strategies/head-and-shoulders";
import { liquidityTailsRuntime } from "../strategies/liquidity-tails";
import { marketFlushReversalRuntime } from "../strategies/market-flush-reversal";
import { relativeRotationRuntime } from "../strategies/relative-rotation";
import { structureZonesRuntime } from "../strategies/structure-zones";
import { trendFollowRuntime } from "../strategies/trend-follow";
import { trendShiftRuntime } from "../strategies/trend-shift";

export const productionDeployment = {
  label: "Production",
  connectorName: "bybit",
  provider: "bybit",
  accountId: "bybit-default",
  enabled: true,
  strategies: {
    CupAndHandle: cupAndHandleRuntime,
    DoubleTap: doubleTapRuntime,
    Dragon: dragonRuntime,
    HeadAndShoulders: headAndShouldersRuntime,
    LiquidityTails: liquidityTailsRuntime,
    MarketFlushReversal: marketFlushReversalRuntime,
    RelativeRotation: relativeRotationRuntime,
    StructureZones: structureZonesRuntime,
    TrendShift: trendShiftRuntime,
    TrendFollow: trendFollowRuntime,
  },
} satisfies RuntimeDeploymentDeclaration;
