import { isIP } from "node:net";
import { isBlockedAddress } from "./blocked-address";
import { createTransport, type HopFailure, type Transport } from "./transport";

export const TIMEOUT_MS = 5000;
export const MAX_REDIRECTS = 5;

export type SafeFetchFailure =
  HopFailure | "invalid_url" | "blocked_scheme" | "too_many_redirects";

export type SafeFetchResult =
  | {
      ok: true;
      status: number;
      finalUrl: string;
      contentType: string | null;
      body: string;
      truncated: boolean;
    }
  | { ok: false; reason: SafeFetchFailure };

type FetchSafelyOptions = {
  transport?: Transport;
};

const defaultTransport = createTransport();

function refusalFor(url: URL): SafeFetchFailure | null {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "blocked_scheme";
  }
  if (url.username || url.password) return "invalid_url";

  const host = url.hostname.replace(/^\[|\]$/g, "");
  return isIP(host) !== 0 && isBlockedAddress(host) ? "blocked_address" : null;
}

/**
 * Fetches a user's link without letting the server reach the internal network.
 * Every hop, including after a redirect, is checked again; the 5 seconds cover
 * the whole chain. `body` is only for reading metadata in memory, never stored.
 */
export async function fetchSafely(
  input: string,
  { transport = defaultTransport }: FetchSafelyOptions = {},
): Promise<SafeFetchResult> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = URL.parse(input);

  for (let redirects = 0; ; redirects++) {
    if (!url) return { ok: false, reason: "invalid_url" };

    const refusal = refusalFor(url);
    if (refusal) return { ok: false, reason: refusal };

    const hop = await transport(url, signal);
    if (!hop.ok) return hop;

    if (hop.location === null) {
      const { status, contentType, body, truncated } = hop;
      return {
        ok: true,
        status,
        finalUrl: url.href,
        contentType,
        body,
        truncated,
      };
    }

    if (redirects === MAX_REDIRECTS) {
      return { ok: false, reason: "too_many_redirects" };
    }
    url = URL.parse(hop.location, url);
  }
}
