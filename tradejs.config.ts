import { basePreset } from "@tradejs/base";
import { defineConfig } from "@tradejs/core/config";
import { runtime } from "./config/runtime";

export default defineConfig(basePreset, { runtime });
