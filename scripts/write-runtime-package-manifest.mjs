import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertExactTradejsVersion } from "./tradejs-version.mjs";

const defaultRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

export const buildRuntimePackageManifest = ({
  root = defaultRoot,
  projectSha = process.env.TRADEJS_PROJECT_SHA || "unknown",
  allowPrerelease = process.env.TRADEJS_ALLOW_PRERELEASE === "true",
} = {}) => {
  const packageJson = readJson(path.join(root, "package.json"));
  const runtimePackages = Object.keys(packageJson.dependencies)
    .filter((name) => name.startsWith("@tradejs/"))
    .sort();
  const packages = Object.fromEntries(
    runtimePackages.map((name) => {
      const declaredVersion = packageJson.dependencies[name];
      assertExactTradejsVersion(name, declaredVersion, { allowPrerelease });
      const installed = readJson(
        path.join(root, "node_modules", ...name.split("/"), "package.json"),
      );
      if (installed.version !== declaredVersion) {
        throw new Error(
          `${name} manifest mismatch: package.json=${declaredVersion} installed=${installed.version}`,
        );
      }
      return [name, installed.version];
    }),
  );
  return {
    schema: "tradejs-runtime-package-manifest/v1",
    projectSha,
    packages,
  };
};

export const writeRuntimePackageManifest = ({
  root = defaultRoot,
  projectSha,
  allowPrerelease,
} = {}) => {
  const manifest = buildRuntimePackageManifest({
    root,
    projectSha,
    allowPrerelease,
  });
  fs.writeFileSync(
    path.join(root, "runtime-package-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
};

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const manifest = writeRuntimePackageManifest();
  console.log(
    `Wrote runtime manifest for ${Object.keys(manifest.packages).length} packages.`,
  );
}
