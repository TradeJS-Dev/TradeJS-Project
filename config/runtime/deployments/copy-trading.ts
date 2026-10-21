import type { RuntimeDeploymentDeclaration } from "@tradejs/types";
import { doubleTapRuntime } from "../strategies/double-tap";
import { headAndShouldersRuntime } from "../strategies/head-and-shoulders";
import { liquidityTailsRuntime } from "../strategies/liquidity-tails";
import { tradingPatternsRuntime } from "../strategies/trading-patterns";

export const copyTradingDeployment = {
  label: "CopyTrading",
  connectorName: "bybit",
  provider: "bybit",
  accountId: "bybit-tradejs",
  enabled: true,
  strategies: {
    DoubleTap: {
      ...doubleTapRuntime,
      config: { ...doubleTapRuntime.config, MAX_LOSS_VALUE: 20 },
    },
    HeadAndShoulders: {
      ...headAndShouldersRuntime,
      config: { ...headAndShouldersRuntime.config, MAX_LOSS_VALUE: 20 },
    },
    LiquidityTails: {
      ...liquidityTailsRuntime,
      config: { ...liquidityTailsRuntime.config, MAX_LOSS_VALUE: 20 },
    },
    TradingPatterns: {
      ...tradingPatternsRuntime,
      config: { ...tradingPatternsRuntime.config, MAX_LOSS_VALUE: 20 },
    },
  },
} satisfies RuntimeDeploymentDeclaration;
