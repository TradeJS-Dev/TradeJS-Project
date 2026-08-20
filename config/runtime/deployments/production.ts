import type { RuntimeDeploymentDeclaration } from "@tradejs/types";
import { doubleTapRuntime } from "../strategies/double-tap";
import { trendFollowRuntime } from "../strategies/trend-follow";
import { trendShiftRuntime } from "../strategies/trend-shift";

export const productionDeployment = {
  label: "Production",
  connectorName: "bybit",
  provider: "bybit",
  accountId: "bybit-default",
  enabled: true,
  strategies: {
    DoubleTap: doubleTapRuntime,
    TrendShift: trendShiftRuntime,
    TrendFollow: trendFollowRuntime,
  },
} satisfies RuntimeDeploymentDeclaration;
