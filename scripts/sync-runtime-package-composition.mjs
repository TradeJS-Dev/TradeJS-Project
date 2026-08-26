import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertProjectTradejsVersion,
  isExactStableTradejsVersion,
  isFrameworkRuntimePackage,
  resolveFrameworkPackageRelease,
} from "./tradejs-version.mjs";

const defaultRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const fetchNpmMetadata = async (packageName, selector) => {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${encodeURIComponent(selector)}`,
    { headers: { accept: "application/json" } },
  );
  if (!response.ok) {
    throw new Error(
      `${packageName}@${selector}: npm returned ${response.status}`,
    );
  }
  return response.json();
};

export const resolveRuntimePackageComposition = async ({
  packageJson,
  frameworkVersion,
  syncStablePackages = false,
  getMetadata = fetchNpmMetadata,
}) => {
  const dependencies = { ...packageJson.dependencies };
  const tradejsPackages = Object.keys(dependencies)
    .filter((name) => name.startsWith("@tradejs/"))
    .sort();
  const frameworkPackages = tradejsPackages.filter(isFrameworkRuntimePackage);
  const frameworkSelector = frameworkVersion || "beta";
  const frameworkMetadata = await Promise.all(
    frameworkPackages.map(async (name) => ({
      name,
      metadata: await getMetadata(name, frameworkSelector),
    })),
  );
  const sourceShas = new Set();
  for (const { name, metadata } of frameworkMetadata) {
    const version = String(metadata.version ?? "");
    assertProjectTradejsVersion(name, version);
    if (!version.includes("-beta.")) {
      throw new Error(`${name}@${frameworkSelector} is not a beta: ${version}`);
    }
    if (frameworkVersion && version !== frameworkVersion) {
      throw new Error(
        `${name}@${frameworkSelector} resolved to unexpected ${version}`,
      );
    }
    const sourceSha = String(metadata.gitHead ?? "");
    if (!/^[0-9a-f]{40}$/.test(sourceSha)) {
      throw new Error(`${name}@${version} has no exact source gitHead`);
    }
    sourceShas.add(sourceSha);
    dependencies[name] = version;
  }
  const release = resolveFrameworkPackageRelease(
    Object.fromEntries(
      frameworkPackages.map((name) => [name, dependencies[name]]),
    ),
  );
  if (release.releaseChannel !== "beta") {
    throw new Error("The production framework channel must resolve to beta");
  }
  if (sourceShas.size !== 1) {
    throw new Error("Framework beta packages do not share one source gitHead");
  }

  const updatedStablePackages = [];
  if (syncStablePackages) {
    const stablePackages = tradejsPackages.filter(
      (name) => !isFrameworkRuntimePackage(name),
    );
    const stableMetadata = await Promise.all(
      stablePackages.map(async (name) => ({
        name,
        metadata: await getMetadata(name, "latest"),
      })),
    );
    for (const { name, metadata } of stableMetadata) {
      const version = String(metadata.version ?? "");
      if (!isExactStableTradejsVersion(version)) {
        throw new Error(
          `${name}@latest is not an exact stable version: ${version}`,
        );
      }
      dependencies[name] = version;
      updatedStablePackages.push(`${name}@${version}`);
    }
  }

  return {
    packageJson: { ...packageJson, dependencies },
    frameworkVersion: release.frameworkVersion,
    frameworkSourceSha: [...sourceShas][0],
    updatedStablePackages,
  };
};

export const syncRuntimePackageComposition = async ({
  root = defaultRoot,
  frameworkVersion = process.env.TRADEJS_FRAMEWORK_VERSION?.trim() || "",
  syncStablePackages = process.env.TRADEJS_SYNC_STABLE_PACKAGES === "true",
  getMetadata,
} = {}) => {
  const packagePath = path.join(root, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const result = await resolveRuntimePackageComposition({
    packageJson,
    frameworkVersion,
    syncStablePackages,
    getMetadata,
  });
  fs.writeFileSync(
    packagePath,
    `${JSON.stringify(result.packageJson, null, 2)}\n`,
  );
  return result;
};

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const result = await syncRuntimePackageComposition();
  console.log(
    `Resolved framework ${result.frameworkVersion} from ${result.frameworkSourceSha}`,
  );
  if (result.updatedStablePackages.length > 0) {
    console.log(result.updatedStablePackages.join("\n"));
  }
}
