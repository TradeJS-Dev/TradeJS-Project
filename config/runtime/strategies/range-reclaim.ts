import type { RuntimeStrategyDeclaration } from "@tradejs/types";
import { rangeReclaimGreenTickers } from "../ticker-sets/range-reclaim-green-20261020";

export const rangeReclaimRuntime = {
  generation: "green-intersection-15-240-risk1-20261020",
  enabled: true,
  selection: {
    tickers: rangeReclaimGreenTickers,
  },
  config: {
    AI_ENABLED: false,
    BACKTEST_ENTRY_DELAY_BARS: 1,
    BACKTEST_PRICE_MODE: "open",
    CLOSE_OPPOSITE_POSITIONS: false,
    INTERVAL: "15",
    UNIVERSE: "crypto",
    LONG: {
      direction: "LONG",
      enable: true,
      minRiskRatio: 1,
    },
    MAX_LOSS_VALUE: 1,
    ML_ENABLED: false,
    RANGE_RECLAIM_ATR_LENGTH: 14,
    RANGE_RECLAIM_ENTRY_POLICY: "intersection",
    RANGE_RECLAIM_MAX_COST_SHARE: 0.01,
    RANGE_RECLAIM_MAX_DEPTH_RATIO: 0.25,
    RANGE_RECLAIM_MAX_HOLD_BARS: 16,
    RANGE_RECLAIM_MAX_SOURCE_AGE_BARS: 4,
    RANGE_RECLAIM_RANGE_INTERVAL: "240",
    RANGE_RECLAIM_STOP_ATR_BUFFER: 2,
    RANGE_RECLAIM_TARGET: "opposite",
    RANGE_RECLAIM_WAIT_BARS: 1,
    RISK_FEE_RATE: 0.001,
    RISK_MARKET_IMPACT_BPS: 0,
    RISK_SLIPPAGE_BPS: 0,
    SHORT: {
      direction: "SHORT",
      enable: true,
      minRiskRatio: 1,
    },
  },
} satisfies RuntimeStrategyDeclaration;
