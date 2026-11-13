import { basePreset } from "@tradejs/base";
import { defineConfig } from "@tradejs/core/config";
import { runtime } from "./config/runtime";

const config = defineConfig(basePreset, {
  strategies: [
    "@tradejs/strategy-trading-patterns",
    "@tradejs/strategy-range-reclaim",
  ],
  runtime,
});

export default {
  ...config,
  launchReports: {
    production: {
      CupAndHandle: "causal-cup-progress-20260825",
      HeadAndShoulders: "rebuilt-long-poc-slope-20260826",
      Dragon: "h5-confirmed-tail-20260831",
      LiquidityTails: "h2b-body-volume-20260829",
      RelativeRotation: "frozen-v6-di22-20260827",
      Flag: "h2-decisive-swing-breakout-20260910",
      VolumeDivergence: "price-pivots-own-gate-20260910",
      MarketFlushReversal: "protected-v1-h1range50-20260824",
      DoubleTap: "production-reference-20260908",
      StructureZones: "transition-breakout-20260825",
      TradingPatterns: "e-late-entry-20261006",
      RangeReclaim: "intersection-low-low-short-20261113",
      TrendShift: "short-q5-20260819",
      TrendFollow: "short-breadth-loss-guard-20260819",
    },
    CopyTrading: {
      DoubleTap: "production-reference-20260908",
      HeadAndShoulders: "rebuilt-long-poc-slope-20260826",
      LiquidityTails: "h2b-body-volume-20260829",
      TradingPatterns: "e-late-entry-20261006",
    },
  },
};
