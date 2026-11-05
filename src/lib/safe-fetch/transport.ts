import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { isBlockedAddress } from "./blocked-address";

export const MAX_BYTES = 1024 * 1024;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type HopFailure =
  "blocked_address" | "timeout" | "unsupported_encoding" | "network_error";

export type HopResult =
  | {
      ok: true;
      status: number;
      location: string | null;
      contentType: string | null;
      body: string;
      truncated: boolean;
    }
  | { ok: false; reason: HopFailure };

export type Transport = (url: URL, signal: AbortSignal) => Promise<HopResult>;

export type ResolveHost = (
  hostname: string,
) => Promise<{ address: string; family: number }[]>;

type TransportOptions = {
  resolve?: ResolveHost;
  isBlocked?: (address: string) => boolean;
};

class BlockedAddressError extends Error {}

/**
 * IP được kiểm tra ngay lúc socket kết nối, nên DNS đổi kết quả sau bước kiểm
 * tra (DNS rebinding) cũng không lọt. Node không gọi `lookup` với IP viết thẳng
 * trong URL; `fetchSafely` chặn trường hợp đó trước khi gọi transport.
 */
function guardedLookup(
  resolve: ResolveHost,
  isBlocked: (address: string) => boolean,
): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname)
      .then((addresses) => {
        const [first] = addresses;
        if (!first) {
          callback(new Error("No address found"), "", 0);
        } else if (addresses.some(({ address }) => isBlocked(address))) {
          callback(new BlockedAddressError(), "", 0);
        } else if (options.all) {
          callback(null, addresses);
        } else {
          callback(null, first.address, first.family);
        }
      })
      .catch((error: NodeJS.ErrnoException) => callback(error, "", 0));
  };
}

function readBody(
  response: http.IncomingMessage,
  onDone: (body: string, truncated: boolean) => void,
  onError: () => void,
) {
  const chunks: Buffer[] = [];
  let size = 0;

  const finish = (truncated: boolean) =>
    onDone(Buffer.concat(chunks).toString("utf8"), truncated);

  response.on("data", (chunk: Buffer) => {
    const room = MAX_BYTES - size;
    chunks.push(chunk.subarray(0, room));
    size += Math.min(chunk.length, room);
    if (chunk.length > room) finish(true);
  });
  response.on("end", () => finish(false));
  response.on("error", onError);
}

/** Một lượt GET, không tự theo redirect. */
export function createTransport({
  resolve = (hostname) => dnsLookup(hostname, { all: true }),
  isBlocked = isBlockedAddress,
}: TransportOptions = {}): Transport {
  const lookup = guardedLookup(resolve, isBlocked);

  return (url, signal) =>
    new Promise((settle) => {
      if (signal.aborted) {
        settle({ ok: false, reason: "timeout" });
        return;
      }

      const client = url.protocol === "https:" ? https : http;
      // `agent: false` là bắt buộc: agent mặc định dùng lại socket cũ và bỏ qua `lookup`.
      const request = client.request(url, {
        agent: false,
        lookup,
        method: "GET",
        headers: {
          accept: "text/html, application/json;q=0.9, */*;q=0.8",
          "accept-encoding": "identity",
          "user-agent": "LearningTrackerBot/1.0",
        },
      });

      const finish = (result: HopResult) => {
        signal.removeEventListener("abort", onAbort);
        settle(result);
        request.destroy();
      };
      const fail = (reason: HopFailure) => finish({ ok: false, reason });
      const onAbort = () => fail("timeout");

      signal.addEventListener("abort", onAbort, { once: true });

      request.on("error", (error) => {
        fail(
          error instanceof BlockedAddressError
            ? "blocked_address"
            : "network_error",
        );
      });

      // Node không phát `response` với 101, nên thiếu dòng này sẽ treo tới deadline.
      request.on("upgrade", () => fail("network_error"));

      request.on("response", (response) => {
        const status = response.statusCode ?? 0;
        const contentType = response.headers["content-type"] ?? null;
        const { location } = response.headers;

        if (REDIRECT_STATUSES.has(status) && location) {
          finish({
            ok: true,
            status,
            location,
            contentType,
            body: "",
            truncated: false,
          });
          return;
        }

        const encoding = response.headers["content-encoding"];
        if (encoding && encoding !== "identity") {
          fail("unsupported_encoding");
          return;
        }

        readBody(
          response,
          (body, truncated) =>
            finish({
              ok: true,
              status,
              location: null,
              contentType,
              body,
              truncated,
            }),
          () => fail("network_error"),
        );
      });

      request.end();
    });
}
