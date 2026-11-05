type Env = Record<string, string | undefined>;

function isTestSignInOn(env: Env): boolean {
  return env.TEST_SIGN_IN_ENABLED === "true";
}

/** Test sign-in exists for local E2E only, so it is refused in production. */
export function canUseTestSignIn(env: Env): boolean {
  return isTestSignInOn(env) && env.NODE_ENV !== "production";
}

export function assertTestSignInOff(env: Env): void {
  if (isTestSignInOn(env)) {
    throw new Error(
      "TEST_SIGN_IN_ENABLED must be off in a production build. Unset it and build again.",
    );
  }
}
