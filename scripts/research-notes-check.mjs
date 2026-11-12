#!/usr/bin/env node

import { fileURLToPath } from "node:url";

process.env.PROJECT_CWD = fileURLToPath(new URL("../", import.meta.url));
await import("../.codex/skills/strategy-backtest-research/scripts/research-notes-check.mjs");
