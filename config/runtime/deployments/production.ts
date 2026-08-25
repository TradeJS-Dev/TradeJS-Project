import type { RuntimeDeploymentDeclaration } from "@tradejs/types";
import { cupAndHandleRuntime } from "../strategies/cup-and-handle";
import { doubleTapRuntime } from "../strategies/double-tap";
import { marketFlushReversalRuntime } from "../strategies/market-flush-reversal";
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
    MarketFlushReversal: marketFlushReversalRuntime,
    StructureZones: structureZonesRuntime,
    TrendShift: trendShiftRuntime,
    TrendFollow: trendFollowRuntime,
  },
} satisfies RuntimeDeploymentDeclaration;
