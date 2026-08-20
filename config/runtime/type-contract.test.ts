import type {
  RuntimeDeploymentDeclaration,
  RuntimeStrategyDeclaration,
} from "@tradejs/types";

const strategy = {
  enabled: true,
  config: {},
} satisfies RuntimeStrategyDeclaration;

({
  ...strategy,
  // @ts-expect-error Manual runtime versions are not part of the declaration.
  version: 1,
}) satisfies RuntimeStrategyDeclaration;

({
  connectorName: "bybit",
  accountId: "bybit-default",
  strategies: { Example: strategy },
  // @ts-expect-error A misspelled deployment field must fail project typecheck.
  tickerss: ["BTCUSDT"],
}) satisfies RuntimeDeploymentDeclaration;
