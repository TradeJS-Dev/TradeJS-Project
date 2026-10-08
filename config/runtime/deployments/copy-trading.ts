import type { RuntimeDeploymentDeclaration } from "@tradejs/types";
import { headAndShouldersRuntime } from "../strategies/head-and-shoulders";
import { liquidityTailsRuntime } from "../strategies/liquidity-tails";

export const copyTradingDeployment = {
  label: "CopyTrading",
  connectorName: "bybit",
  provider: "bybit",
  accountId: "bybit-tradejs",
  enabled: true,
  strategies: {
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
