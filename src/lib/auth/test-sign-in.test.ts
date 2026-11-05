import { describe, expect, it } from "vitest";
import { assertTestSignInOff, canUseTestSignIn } from "./test-sign-in";

describe("canUseTestSignIn", () => {
  it("should allow test sign-in when the flag is on outside production", () => {
    expect(
      canUseTestSignIn({
        TEST_SIGN_IN_ENABLED: "true",
        NODE_ENV: "development",
      }),
    ).toBe(true);
  });

  it("should refuse test sign-in when running in production", () => {
    expect(
      canUseTestSignIn({
        TEST_SIGN_IN_ENABLED: "true",
        NODE_ENV: "production",
      }),
    ).toBe(false);
  });

  it.each([undefined, "", "false", "1"])(
    "should refuse test sign-in when the flag is not exactly true: %s",
    (flag) => {
      expect(
        canUseTestSignIn({
          TEST_SIGN_IN_ENABLED: flag,
          NODE_ENV: "development",
        }),
      ).toBe(false);
    },
  );
});

describe("assertTestSignInOff", () => {
  it("should fail the build when test sign-in is on", () => {
    expect(() => assertTestSignInOff({ TEST_SIGN_IN_ENABLED: "true" })).toThrow(
      /TEST_SIGN_IN_ENABLED/,
    );
  });

  it("should pass the build when test sign-in is off", () => {
    expect(() => assertTestSignInOff({})).not.toThrow();
  });
});
