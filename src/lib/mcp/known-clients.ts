const CLAUDE_HOSTS = ["claude.ai", "claude.com"];
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Anyone can register a client under any name, so only the address it returns
 * to says who it is. Claude's web callback and local apps such as Claude Code
 * are known; every other address is shown as unverified.
 */
export function isKnownRedirect(redirectUri: string) {
  const url = URL.canParse(redirectUri) ? new URL(redirectUri) : null;
  if (!url) return false;
  if (url.protocol === "https:" && CLAUDE_HOSTS.includes(url.hostname)) {
    return true;
  }
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    LOCAL_HOSTS.includes(url.hostname)
  );
}

/** The part of the address a person can recognize. */
export function redirectHost(redirectUri: string) {
  const host = URL.canParse(redirectUri) ? new URL(redirectUri).host : "";
  return host || redirectUri;
}
