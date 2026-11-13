import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  buildTickerProfileSnapshot,
  isTickerProfileSnapshot,
  tickerProfileMonth,
} from "@tradejs/core/tickerProfiles";
import {
  readTickerProfiles,
  writeTickerProfiles,
} from "@tradejs/infra/tickerProfiles";
import { closeTimescalePool } from "@tradejs/infra/timescale/client";
import { getConnectorCreatorByProvider } from "@tradejs/node/connectors";
import { rangeReclaimGreenTickers } from "../config/runtime/ticker-sets/range-reclaim-green-20261020.ts";

const provider = "bybit";
const universeId = "range-reclaim-frozen577-20261111";
const hour = 3_600_000;
const projectRoot = process.env.PROJECT_CWD ?? process.cwd();
const mode = process.argv[2];
const asOf = tickerProfileMonth(Date.now());
const symbols = [...rangeReclaimGreenTickers].sort();
const seedMonth = Date.UTC(2026, 10, 1);
const seedRoot = fileURLToPath(
  new URL(
    "../config/runtime/ticker-sets/range-reclaim-november-2026-profile.json",
    import.meta.url,
  ),
);

function verify(snapshot) {
  if (
    !isTickerProfileSnapshot(snapshot) ||
    snapshot.provider !== provider ||
    snapshot.universeId !== universeId ||
    snapshot.asOf !== asOf ||
    snapshot.membership !== "frozen-list" ||
    snapshot.profiles.length !== rangeReclaimGreenTickers.length ||
    !snapshot.profiles.every(({ symbol }, index) => symbol === symbols[index])
  ) {
    throw new Error("Invalid RangeReclaim monthly profile");
  }
  const known = snapshot.profiles.filter(
    ({ moneyGroup, volatilityGroup }) =>
      moneyGroup !== "unknown" && volatilityGroup !== "unknown",
  );
  if (
    !known.length ||
    !known.some(({ symbol }) => symbol === "BTCUSDT") ||
    !known.some(({ symbol }) => symbol === "ETHUSDT")
  ) {
    throw new Error("RangeReclaim monthly profile lacks benchmark coverage");
  }
  return known.length;
}

async function refresh() {
  const create = await getConnectorCreatorByProvider(provider, projectRoot);
  if (!create) throw new Error("Bybit market data connector unavailable");
  const connector = await create({ userName: "root", universe: "crypto" });
  const candlesBySymbol = {};
  const queue = [...rangeReclaimGreenTickers];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let symbol; (symbol = queue.shift());) {
        candlesBySymbol[symbol] = (
          await connector.kline({
            symbol,
            interval: "60",
            start: asOf - 721 * hour,
            end: asOf - hour,
            silent: true,
          })
        ).filter(({ timestamp }) => timestamp < asOf);
      }
    }),
  );
  return buildTickerProfileSnapshot({
    asOf,
    provider,
    universeId,
    membership: "frozen-list",
    candlesBySymbol,
  });
}

try {
  const existing = await readTickerProfiles(
    projectRoot,
    provider,
    universeId,
    asOf,
  );
  if (asOf === seedMonth) {
    const { payload, snapshotId } = JSON.parse(
      await readFile(seedRoot, "utf8"),
    );
    if (createHash("sha256").update(payload).digest("hex") !== snapshotId)
      throw new Error("RangeReclaim profile seed checksum mismatch");
    if (existing && existing.snapshotId !== snapshotId)
      throw new Error(
        "RangeReclaim current profile differs from the release snapshot",
      );
    const snapshot = JSON.parse(payload);
    const known = verify(snapshot);
    console.log(
      "RangeReclaim ticker profile ready",
      existing?.snapshotId ??
        (await writeTickerProfiles(projectRoot, snapshot)),
      known,
    );
  } else if (existing) {
    console.log(
      "RangeReclaim ticker profile ready",
      existing.snapshotId,
      verify(existing.snapshot),
    );
  } else if (mode === "refresh") {
    const snapshot = await refresh();
    const known = verify(snapshot);
    console.log(
      "RangeReclaim ticker profile ready",
      await writeTickerProfiles(projectRoot, snapshot),
      known,
    );
  } else {
    throw new Error("RangeReclaim current-month ticker profile missing");
  }
} finally {
  await closeTimescalePool();
}
