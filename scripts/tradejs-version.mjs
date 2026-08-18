import fs from "node:fs";
import path from "node:path";

export const TRADEJS_FRAMEWORK_PACKAGES = [
  "@tradejs/app",
  "@tradejs/cli",
  "@tradejs/connectors",
  "@tradejs/core",
  "@tradejs/indicators",
  "@tradejs/infra",
  "@tradejs/node",
  "@tradejs/types",
];

const EXACT_STABLE_VERSION = /^\d+\.\d+\.\d+$/;
const EXACT_PRERELEASE_VERSION =
  /^\d+\.\d+\.\d+-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*$/;

export const isExactTradejsVersion = (
  version,
  { allowPrerelease = false } = {},
) =>
  EXACT_STABLE_VERSION.test(String(version)) ||
  (allowPrerelease && EXACT_PRERELEASE_VERSION.test(String(version)));

export const assertExactTradejsVersion = (
  name,
  version,
  { allowPrerelease = false } = {},
) => {
  if (!isExactTradejsVersion(version, { allowPrerelease })) {
    throw new Error(
      `${name} must use an exact ${allowPrerelease ? "stable or prerelease" : "stable"} version`,
    );
  }
};

export const setTradejsFrameworkVersion = ({ root, version }) => {
  return setTradejsPackageVersions({
    root,
    packageNames: TRADEJS_FRAMEWORK_PACKAGES,
    version,
  });
};

export const setTradejsPackageVersions = ({ root, packageNames, version }) => {
  assertExactTradejsVersion("Framework version", version, {
    allowPrerelease: true,
  });
  const uniquePackageNames = [...new Set(packageNames)];
  if (
    uniquePackageNames.length === 0 ||
    uniquePackageNames.some((name) => !/^@tradejs\/[a-z0-9-]+$/.test(name))
  ) {
    throw new Error("Expected existing @tradejs package names");
  }
  const packagePath = path.join(root, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  for (const packageName of uniquePackageNames) {
    if (!Object.hasOwn(packageJson.dependencies ?? {}, packageName)) {
      throw new Error(`Missing framework dependency: ${packageName}`);
    }
    packageJson.dependencies[packageName] = version;
  }
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  return packageJson;
};
