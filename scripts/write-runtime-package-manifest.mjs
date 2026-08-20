import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import semver from "semver";
import { assertExactTradejsVersion } from "./tradejs-version.mjs";

const defaultRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const resolveProjectSha = (root, projectSha) => {
  if (projectSha !== undefined) {
    if (!/^[a-f0-9]{40}$/.test(projectSha)) {
      throw new Error(`Invalid Project SHA: ${projectSha}`);
    }
    return projectSha;
  }
  try {
    const resolved = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!/^[a-f0-9]{40}$/.test(resolved)) throw new Error("invalid Git SHA");
    return resolved;
  } catch {
    throw new Error(`Unable to resolve Project SHA from ${root}`);
  }
};

const usesHostProvidedRuntime = (packageName) =>
  packageName === "@tradejs/base" ||
  packageName === "@tradejs/strategy-kit" ||
  packageName.startsWith("@tradejs/strategy-");

export const buildRuntimePackageManifest = ({
  root = defaultRoot,
  projectSha = process.env.TRADEJS_PROJECT_SHA || undefined,
} = {}) => {
  const resolvedProjectSha = resolveProjectSha(root, projectSha);
  const packageJson = readJson(path.join(root, "package.json"));
  const directRuntimePackages = Object.keys(packageJson.dependencies)
    .filter((name) => name.startsWith("@tradejs/"))
    .sort();
  for (const name of directRuntimePackages) {
    assertExactTradejsVersion(name, packageJson.dependencies[name]);
  }

  const packages = {};
  const requirements = [];
  const queue = [...directRuntimePackages];
  while (queue.length > 0) {
    const name = queue.shift();
    if (Object.hasOwn(packages, name)) continue;
    const installed = readJson(
      path.join(root, "node_modules", ...name.split("/"), "package.json"),
    );
    if (installed.name !== name || typeof installed.version !== "string") {
      throw new Error(`Invalid installed package manifest: ${name}`);
    }
    assertExactTradejsVersion(name, installed.version);
    const declaredVersion = packageJson.dependencies[name];
    if (
      declaredVersion !== undefined &&
      installed.version !== declaredVersion
    ) {
      throw new Error(
        `${name} manifest mismatch: package.json=${declaredVersion} installed=${installed.version}`,
      );
    }
    packages[name] = installed.version;
    const runtimeDependencies = Object.entries(
      installed.dependencies ?? {},
    ).filter(([dependencyName]) => dependencyName.startsWith("@tradejs/"));
    if (usesHostProvidedRuntime(name) && runtimeDependencies.length > 0) {
      throw new Error(
        `${name} must use host-provided TradeJS peers, not dependencies: ${runtimeDependencies
          .map(([dependencyName]) => dependencyName)
          .sort()
          .join(", ")}`,
      );
    }
    const runtimePeers = Object.entries(
      installed.peerDependencies ?? {},
    ).filter(([dependencyName]) => dependencyName.startsWith("@tradejs/"));
    const runtimeRequirements = [...runtimeDependencies, ...runtimePeers];
    for (const [dependencyName, range] of runtimeRequirements) {
      if (typeof range !== "string" || !range.trim()) {
        throw new Error(
          `Invalid ${name} dependency range for ${dependencyName}`,
        );
      }
      requirements.push({ owner: name, dependencyName, range });
    }
    const dependencyNames = runtimeRequirements
      .map(([dependencyName]) => dependencyName)
      .sort();
    queue.push(...dependencyNames);
  }
  for (const { owner, dependencyName, range } of requirements) {
    const installedVersion = packages[dependencyName];
    if (
      !installedVersion ||
      !semver.satisfies(installedVersion, range, { includePrerelease: true })
    ) {
      throw new Error(
        `${owner} requires ${dependencyName}@${range} but host installed ${installedVersion ?? "nothing"}`,
      );
    }
  }
  const enginePackages = directRuntimePackages
    .filter((name) => !usesHostProvidedRuntime(name))
    .map((name) => `${name}@${packages[name]}`);
  const engineVersions = new Set(
    directRuntimePackages
      .filter((name) => !usesHostProvidedRuntime(name))
      .map((name) => packages[name]),
  );
  if (engineVersions.size !== 1) {
    throw new Error(
      `Engine package family must use one version: ${enginePackages.join(", ")}`,
    );
  }
  return {
    schema: "tradejs-runtime-package-manifest/v1",
    projectSha: resolvedProjectSha,
    packages: Object.fromEntries(
      Object.entries(packages).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  };
};

export const writeRuntimePackageManifest = ({
  root = defaultRoot,
  projectSha,
} = {}) => {
  const manifest = buildRuntimePackageManifest({
    root,
    projectSha,
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
