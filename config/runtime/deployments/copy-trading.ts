import type { RuntimeDeploymentDeclaration } from "@tradejs/types";
import { doubleTapRuntime } from "../strategies/double-tap";
import { headAndShouldersRuntime } from "../strategies/head-and-shoulders";
import { liquidityTailsRuntime } from "../strategies/liquidity-tails";

export const copyTradingDeployment = {
  label: "CopyTrading",
  connectorName: "bybit",
  provider: "bybit",
  accountId: "bybit-tradejs",
  enabled: true,
  strategies: {
    DoubleTap: {
      ...doubleTapRuntime,
      config: { ...doubleTapRuntime.config, MAX_LOSS_VALUE: 2 },
    },
    HeadAndShoulders: {
      ...headAndShouldersRuntime,
      config: { ...headAndShouldersRuntime.config, MAX_LOSS_VALUE: 5 },
    },
    LiquidityTails: {
      ...liquidityTailsRuntime,
      config: { ...liquidityTailsRuntime.config, MAX_LOSS_VALUE: 5 },
    },
  },
} satisfies RuntimeDeploymentDeclaration;
