const EXACT_STABLE_VERSION = /^\d+\.\d+\.\d+$/;
const EXACT_BETA_VERSION = /^\d+\.\d+\.\d+-beta\.[1-9]\d*$/;

export const isExactTradejsVersion = (version) =>
  EXACT_STABLE_VERSION.test(String(version)) ||
  EXACT_BETA_VERSION.test(String(version));

export const isExactStableTradejsVersion = (version) =>
  EXACT_STABLE_VERSION.test(String(version));

export const isFrameworkRuntimePackage = (packageName) =>
  packageName.startsWith("@tradejs/") &&
  packageName !== "@tradejs/base" &&
  packageName !== "@tradejs/strategy-kit" &&
  !packageName.startsWith("@tradejs/strategy-");

export const assertExactTradejsVersion = (name, version) => {
  if (!isExactTradejsVersion(version)) {
    throw new Error(`${name} must use an exact stable or beta version`);
  }
};

export const assertProjectTradejsVersion = (name, version) => {
  assertExactTradejsVersion(name, version);
  if (
    !isFrameworkRuntimePackage(name) &&
    !isExactStableTradejsVersion(version)
  ) {
    throw new Error(`${name} must use an exact stable version`);
  }
};

export const resolveFrameworkPackageRelease = (packages) => {
  const frameworkPackages = Object.entries(packages)
    .filter(([name]) => isFrameworkRuntimePackage(name))
    .sort(([left], [right]) => left.localeCompare(right));
  if (frameworkPackages.length === 0) {
    throw new Error("Project composition has no TradeJS framework packages");
  }
  for (const [name, version] of frameworkPackages) {
    assertProjectTradejsVersion(name, version);
  }
  const versions = new Set(frameworkPackages.map(([, version]) => version));
  if (versions.size !== 1) {
    throw new Error(
      `Framework package family must use one version: ${frameworkPackages
        .map(([name, version]) => `${name}@${version}`)
        .join(", ")}`,
    );
  }
  const frameworkVersion = frameworkPackages[0][1];
  return {
    releaseChannel: isExactStableTradejsVersion(frameworkVersion)
      ? "stable"
      : "beta",
    frameworkVersion,
  };
};
