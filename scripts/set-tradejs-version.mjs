#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  setTradejsFrameworkVersion,
  TRADEJS_FRAMEWORK_PACKAGES,
} from "./tradejs-version.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = String(process.argv[2] ?? "").trim();
if (!version) throw new Error("Usage: set-tradejs-version.mjs <exact-version>");

setTradejsFrameworkVersion({ root, version });
console.log(
  `Set ${TRADEJS_FRAMEWORK_PACKAGES.length} TradeJS framework packages to ${version}.`,
);
