import type { TradejsRuntimeDeclaration } from "@tradejs/types";
import { copyTradingDeployment } from "./deployments/copy-trading";
import { productionDeployment } from "./deployments/production";

export const runtime = {
  deployments: {
    production: productionDeployment,
    CopyTrading: copyTradingDeployment,
  },
} satisfies TradejsRuntimeDeclaration;
