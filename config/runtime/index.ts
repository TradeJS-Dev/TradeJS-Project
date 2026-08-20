import { productionDeployment } from "./deployments/production";

export const runtime = {
  deployments: {
    production: productionDeployment,
  },
};
