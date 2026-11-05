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
 * Tải link người dùng đưa vào mà không để server bị dùng để gọi mạng nội bộ.
 * Mọi lượt, kể cả sau redirect, đều được kiểm tra lại; 5 giây tính chung cho cả
 * chuỗi. `body` chỉ dùng trong bộ nhớ để lấy metadata, không được lưu lại.
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
