#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTradejsPackageVersions } from "./tradejs-version.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageNames = String(process.argv[2] ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);
const version = String(process.argv[3] ?? "").trim();
if (!packageNames.length || !version) {
  throw new Error(
    "Usage: set-tradejs-package-version.mjs <package[,package]> <exact-version>",
  );
}

setTradejsPackageVersions({ root, packageNames, version });
console.log(`Set ${packageNames.join(", ")} to ${version}.`);
