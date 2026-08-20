import assert from "node:assert/strict";
import test from "node:test";
import { assertExactTradejsVersion } from "./tradejs-version.mjs";

test("Project dependencies must be exact stable versions", () => {
  assert.doesNotThrow(() =>
    assertExactTradejsVersion("@tradejs/node", "3.1.8"),
  );
  assert.throws(
    () => assertExactTradejsVersion("@tradejs/node", "3.1.8-beta.42"),
    /exact stable version/,
  );
  assert.throws(
    () => assertExactTradejsVersion("@tradejs/node", "^3.1.8"),
    /exact stable version/,
  );
});
