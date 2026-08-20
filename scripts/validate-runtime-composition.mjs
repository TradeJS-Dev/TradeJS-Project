#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRuntimeComposition } from "@tradejs/node/runtimeStrategies";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const composition = await resolveRuntimeComposition({ projectRoot });

const summary = composition.deployments.map((deployment) => ({
  deploymentId: deployment.deploymentId,
  deploymentCompositionId: deployment.deploymentCompositionId,
  strategies: deployment.strategies.map((strategy) => ({
    strategyName: strategy.strategyName,
    strategyRevision: strategy.strategyRevision,
  })),
}));

console.log(JSON.stringify(summary, null, 2));
