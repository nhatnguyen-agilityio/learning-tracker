const CLAUDE_CALLBACKS = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
];
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Anyone can register a client under any name, so only the address it returns
 * to says who it is. Claude's exact web callback and local apps such as Claude
 * Code are known; every other address is shown as unverified.
 */
export function isKnownRedirect(redirectUri: string) {
  const url = URL.canParse(redirectUri) ? new URL(redirectUri) : null;
  if (!url) return false;
  if (CLAUDE_CALLBACKS.includes(url.href)) return true;
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    LOCAL_HOSTS.includes(url.hostname)
  );
}

/** The host alone only names who gets the code when the address is https. */
export function redirectHost(redirectUri: string) {
  const url = URL.canParse(redirectUri) ? new URL(redirectUri) : null;
  return url?.protocol === "https:" ? url.host : redirectUri;
}
