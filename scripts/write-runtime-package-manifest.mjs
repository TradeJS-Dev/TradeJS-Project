import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const runtimePackages = Object.keys(packageJson.dependencies)
  .filter((name) => name.startsWith("@tradejs/"))
  .sort();
const packages = Object.fromEntries(
  runtimePackages.map((name) => {
    const installedPath = path.join(
      root,
      "node_modules",
      ...name.split("/"),
      "package.json",
    );
    const installed = JSON.parse(fs.readFileSync(installedPath, "utf8"));
    return [name, installed.version];
  }),
);
const manifest = {
  schema: "tradejs-runtime-package-manifest/v1",
  projectSha: process.env.TRADEJS_PROJECT_SHA || "unknown",
  packages,
};
fs.writeFileSync(
  path.join(root, "runtime-package-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`Wrote runtime manifest for ${runtimePackages.length} packages.`);
