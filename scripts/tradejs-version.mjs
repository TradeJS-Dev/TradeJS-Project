const EXACT_STABLE_VERSION = /^\d+\.\d+\.\d+$/;

export const isExactTradejsVersion = (version) =>
  EXACT_STABLE_VERSION.test(String(version));

export const assertExactTradejsVersion = (name, version) => {
  if (!isExactTradejsVersion(version)) {
    throw new Error(`${name} must use an exact stable version`);
  }
};
