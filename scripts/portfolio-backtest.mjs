import { access } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const configuredFrameworkRoot = String(
  process.env.TRADEJS_FRAMEWORK_REPOSITORY_ROOT ?? "",
).trim();
const frameworkRoot = configuredFrameworkRoot
  ? path.resolve(configuredFrameworkRoot)
  : path.resolve(projectRoot, "../investing");
const sourceCli = path.join(frameworkRoot, "packages/cli/dist/cli.js");

const exists = async (target) => {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
};

const useSourceCli = await exists(sourceCli);
const command = useSourceCli
  ? process.execPath
  : path.join(projectRoot, "node_modules/.bin/tradejs");
const args = useSourceCli
  ? [sourceCli, "portfolio-backtest", ...process.argv.slice(2)]
  : ["portfolio-backtest", ...process.argv.slice(2)];
const preventIdleSleep = process.platform === "darwin";
const child = spawn(
  preventIdleSleep ? "/usr/bin/caffeinate" : command,
  preventIdleSleep ? ["-i", command, ...args] : args,
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      PROJECT_CWD: projectRoot,
      DOTENV_CONFIG_PATH:
        process.env.DOTENV_CONFIG_PATH || path.join(projectRoot, ".env"),
      NODE_OPTIONS:
        process.env.NODE_OPTIONS || "--max-old-space-size=2048 --expose-gc",
      MARKET_CONTEXT_STAGE_TIMEOUT_MS:
        process.env.MARKET_CONTEXT_STAGE_TIMEOUT_MS || "3600000",
      BINANCE_MARKET_CONTEXT_STAGE_TIMEOUT_MS:
        process.env.BINANCE_MARKET_CONTEXT_STAGE_TIMEOUT_MS || "3600000",
      COINMARKETCAP_CONTEXT_STAGE_TIMEOUT_MS:
        process.env.COINMARKETCAP_CONTEXT_STAGE_TIMEOUT_MS || "3600000",
      DERIVATIVES_CONTEXT_STAGE_TIMEOUT_MS:
        process.env.DERIVATIVES_CONTEXT_STAGE_TIMEOUT_MS || "3600000",
      HYPERLIQUID_WHALE_CONTEXT_STAGE_TIMEOUT_MS:
        process.env.HYPERLIQUID_WHALE_CONTEXT_STAGE_TIMEOUT_MS || "3600000",
    },
    stdio: "inherit",
  },
);

child.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
