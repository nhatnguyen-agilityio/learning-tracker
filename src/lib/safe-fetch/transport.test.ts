import { createServer, type RequestListener, type Server } from "node:http";
import { setDefaultAutoSelectFamily, type AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTransport, MAX_BYTES, type ResolveHost } from "./transport";

// Server chỉ chạy trên loopback; hostname trong URL không bao giờ ra DNS thật.
const servers: Server[] = [];

async function startServer(listener: RequestListener) {
  const server = createServer(listener);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: new URL(`http://site.test:${port}/`) };
}

const loopback: ResolveHost = async () => [{ address: "127.0.0.1", family: 4 }];
const allowAll = () => false;
const openTransport = () =>
  createTransport({ resolve: loopback, isBlocked: allowAll });
const noDeadline = () => new AbortController().signal;

afterEach(async () => {
  vi.restoreAllMocks();
  setDefaultAutoSelectFamily(true);
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

describe("createTransport", () => {
  it("should return the body when the server answers", async () => {
    const { url } = await startServer((_req, res) => {
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end("<title>Xin chào</title>");
    });

    const result = await openTransport()(url, noDeadline());

    expect(result).toEqual({
      ok: true,
      status: 200,
      location: null,
      contentType: "text/html; charset=utf-8",
      body: "<title>Xin chào</title>",
      truncated: false,
    });
  });

  it("should send a plain GET when it calls the server", async () => {
    const seen: { method?: string; encoding?: string; cookie?: string }[] = [];
    const { url } = await startServer((req, res) => {
      seen.push({
        method: req.method,
        encoding: req.headers["accept-encoding"],
        cookie: req.headers.cookie,
      });
      res.end();
    });

    await openTransport()(url, noDeadline());

    expect(seen).toEqual([
      { method: "GET", encoding: "identity", cookie: undefined },
    ]);
  });

  it("should return the status when the server answers with an error", async () => {
    const { url } = await startServer((_req, res) => {
      res.statusCode = 404;
      res.end("missing");
    });

    const result = await openTransport()(url, noDeadline());

    expect(result).toMatchObject({ ok: true, status: 404, body: "missing" });
  });

  it.each([[301], [302], [303], [307], [308]])(
    "should return the location without reading when the server answers %i",
    async (status) => {
      const { url } = await startServer((_req, res) => {
        res.statusCode = status;
        res.setHeader("location", "/next");
        res.end("ignored");
      });

      const result = await openTransport()(url, noDeadline());

      expect(result).toMatchObject({
        ok: true,
        status,
        location: "/next",
        body: "",
      });
    },
  );

  it("should not treat the response as a redirect when location is missing", async () => {
    const { url } = await startServer((_req, res) => {
      res.statusCode = 302;
      res.end();
    });

    const result = await openTransport()(url, noDeadline());

    expect(result).toMatchObject({ ok: true, status: 302, location: null });
  });

  it("should block without connecting when DNS answers an internal IP", async () => {
    const listener = vi.fn<RequestListener>((_req, res) => res.end());
    const { server, url } = await startServer(listener);
    const connection = vi.fn();
    server.on("connection", connection);

    const result = await createTransport({ resolve: loopback })(
      url,
      noDeadline(),
    );

    expect(result).toEqual({ ok: false, reason: "blocked_address" });
    expect(connection).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it("should block when a host has one public and one internal IP", async () => {
    const { server, url } = await startServer((_req, res) => res.end());
    const connection = vi.fn();
    server.on("connection", connection);
    const resolve: ResolveHost = async () => [
      { address: "127.0.0.1", family: 4 },
      { address: "127.0.0.2", family: 4 },
    ];
    const transport = createTransport({
      resolve,
      isBlocked: (address) => address === "127.0.0.2",
    });

    const result = await transport(url, noDeadline());

    expect(result).toEqual({ ok: false, reason: "blocked_address" });
    expect(connection).not.toHaveBeenCalled();
  });

  it("should connect to the checked address when Node asks for one address", async () => {
    setDefaultAutoSelectFamily(false);
    const { url } = await startServer((_req, res) => res.end("ok"));

    const result = await openTransport()(url, noDeadline());

    expect(result).toMatchObject({ ok: true, body: "ok" });
  });

  it("should block when Node asks for one address and any is internal", async () => {
    setDefaultAutoSelectFamily(false);
    const { server, url } = await startServer((_req, res) => res.end());
    const connection = vi.fn();
    server.on("connection", connection);
    const transport = createTransport({
      resolve: async () => [
        { address: "127.0.0.1", family: 4 },
        { address: "127.0.0.2", family: 4 },
      ],
      isBlocked: (address) => address === "127.0.0.2",
    });

    const result = await transport(url, noDeadline());

    expect(result).toEqual({ ok: false, reason: "blocked_address" });
    expect(connection).not.toHaveBeenCalled();
  });

  it("should not log the page when a fetch succeeds", async () => {
    const logs = (["log", "info", "warn", "error", "debug"] as const).map(
      (method) => vi.spyOn(console, method),
    );
    const { url } = await startServer((_req, res) => res.end("secret page"));

    await openTransport()(url, noDeadline());

    for (const log of logs) expect(log).not.toHaveBeenCalled();
  });

  it("should report a network error when the server switches protocols", async () => {
    const { url } = await startServer((req) => {
      req.socket.write(
        "HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: x\r\n\r\n",
      );
    });

    const result = await openTransport()(url, noDeadline());

    expect(result).toEqual({ ok: false, reason: "network_error" });
  });

  it("should fail instead of hanging when the address check throws", async () => {
    const { url } = await startServer((_req, res) => res.end());
    const transport = createTransport({
      resolve: loopback,
      isBlocked: () => {
        throw new Error("broken check");
      },
    });

    const result = await transport(url, noDeadline());

    expect(result).toEqual({ ok: false, reason: "network_error" });
  });

  it("should check the address when the url is https", async () => {
    const resolve = vi.fn<ResolveHost>(loopback);

    const result = await createTransport({ resolve })(
      new URL("https://site.test/"),
      noDeadline(),
    );

    expect(result).toEqual({ ok: false, reason: "blocked_address" });
    expect(resolve).toHaveBeenCalledExactlyOnceWith("site.test");
  });

  it("should resolve again when the same host is fetched twice", async () => {
    const { server, url } = await startServer((_req, res) => res.end("ok"));
    const connection = vi.fn();
    server.on("connection", connection);
    const resolve = vi
      .fn<ResolveHost>()
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }])
      .mockResolvedValueOnce([{ address: "127.0.0.2", family: 4 }]);
    const transport = createTransport({
      resolve,
      isBlocked: (address) => address === "127.0.0.2",
    });

    const first = await transport(url, noDeadline());
    const second = await transport(url, noDeadline());

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: "blocked_address" });
    expect(connection).toHaveBeenCalledTimes(1);
  });

  it("should open a new connection when two hops hit one server", async () => {
    const { server, url } = await startServer((_req, res) => res.end("ok"));
    const connection = vi.fn();
    server.on("connection", connection);
    const transport = openTransport();

    await transport(url, noDeadline());
    await transport(url, noDeadline());

    expect(connection).toHaveBeenCalledTimes(2);
  });

  it("should time out when the server never answers", async () => {
    const { url } = await startServer(() => {});

    const result = await openTransport()(url, AbortSignal.timeout(50));

    expect(result).toEqual({ ok: false, reason: "timeout" });
  });

  it("should time out when the server drips the body too slowly", async () => {
    const { url } = await startServer((_req, res) => {
      const drip = setInterval(() => res.write("x"), 10);
      res.on("close", () => clearInterval(drip));
    });

    const result = await openTransport()(url, AbortSignal.timeout(80));

    expect(result).toEqual({ ok: false, reason: "timeout" });
  });

  it("should time out when DNS never answers", async () => {
    const transport = createTransport({
      resolve: () => new Promise(() => {}),
    });

    const result = await transport(
      new URL("http://site.test/"),
      AbortSignal.timeout(50),
    );

    expect(result).toEqual({ ok: false, reason: "timeout" });
  });

  it("should time out when the deadline has already passed", async () => {
    const resolve = vi.fn<ResolveHost>(loopback);

    const result = await createTransport({ resolve })(
      new URL("http://site.test/"),
      AbortSignal.abort(),
    );

    expect(result).toEqual({ ok: false, reason: "timeout" });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("should stop at the limit when the body has a large content length", async () => {
    const size = MAX_BYTES * 2;
    const { url } = await startServer((_req, res) => {
      res.setHeader("content-length", size);
      res.end(Buffer.alloc(size, "a"));
    });

    const result = await openTransport()(url, noDeadline());

    expect(result).toMatchObject({ ok: true, truncated: true });
    expect(result.ok && Buffer.byteLength(result.body)).toBe(MAX_BYTES);
  });

  it("should close the socket when an endless body passes the limit", async () => {
    let closed = false;
    const { url } = await startServer((_req, res) => {
      const chunk = Buffer.alloc(64 * 1024, "a");
      const pump = () => {
        while (!res.destroyed && res.write(chunk));
      };
      res.on("drain", pump);
      res.on("close", () => {
        closed = true;
      });
      pump();
    });

    const result = await openTransport()(url, noDeadline());

    expect(result).toMatchObject({ ok: true, truncated: true });
    expect(result.ok && Buffer.byteLength(result.body)).toBe(MAX_BYTES);
    await vi.waitFor(() => expect(closed).toBe(true));
  });

  it("should not mark the body as cut when it is exactly at the limit", async () => {
    const { url } = await startServer((_req, res) => {
      res.end(Buffer.alloc(MAX_BYTES, "a"));
    });

    const result = await openTransport()(url, noDeadline());

    expect(result).toMatchObject({ ok: true, truncated: false });
  });

  it("should refuse the body when the server compresses it", async () => {
    const { url } = await startServer((_req, res) => {
      res.setHeader("content-encoding", "gzip");
      res.end("compressed");
    });

    const result = await openTransport()(url, noDeadline());

    expect(result).toEqual({ ok: false, reason: "unsupported_encoding" });
  });

  it("should report a network error when DNS fails", async () => {
    const transport = createTransport({
      resolve: async () => {
        throw new Error("ENOTFOUND");
      },
    });

    const result = await transport(new URL("http://site.test/"), noDeadline());

    expect(result).toEqual({ ok: false, reason: "network_error" });
  });

  it("should report a network error when DNS returns nothing", async () => {
    const transport = createTransport({ resolve: async () => [] });

    const result = await transport(new URL("http://site.test/"), noDeadline());

    expect(result).toEqual({ ok: false, reason: "network_error" });
  });

  it("should report a network error when the server drops the connection", async () => {
    const { url } = await startServer((req) => req.socket.destroy());

    const result = await openTransport()(url, noDeadline());

    expect(result).toEqual({ ok: false, reason: "network_error" });
  });

  it("should report a network error when the body ends early", async () => {
    const { url } = await startServer((req, res) => {
      res.setHeader("content-length", 100);
      res.write("short", () => req.socket.destroy());
    });

    const result = await openTransport()(url, noDeadline());

    expect(result).toEqual({ ok: false, reason: "network_error" });
  });
});
