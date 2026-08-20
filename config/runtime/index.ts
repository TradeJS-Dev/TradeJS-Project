import type { TradejsRuntimeDeclaration } from "@tradejs/types";
import { productionDeployment } from "./deployments/production";

export const runtime = {
  deployments: {
    production: productionDeployment,
  },
} satisfies TradejsRuntimeDeclaration;
