import type { TradejsRuntimeDeclaration } from "@tradejs/types";
import { agentDeployment } from "./deployments/agent";
import { copyTradingDeployment } from "./deployments/copy-trading";
import { productionDeployment } from "./deployments/production";

export const runtime = {
  deployments: {
    production: productionDeployment,
    CopyTrading: copyTradingDeployment,
    Agent: agentDeployment,
  },
} satisfies TradejsRuntimeDeclaration;
