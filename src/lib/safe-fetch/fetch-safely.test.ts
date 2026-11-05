import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSafely, TIMEOUT_MS } from "./fetch-safely";
import type { HopResult, Transport } from "./transport";

function page(body = "<html></html>"): HopResult {
  return {
    ok: true,
    status: 200,
    location: null,
    contentType: "text/html",
    body,
    truncated: false,
  };
}

function redirect(location: string): HopResult {
  return {
    ok: true,
    status: 302,
    location,
    contentType: null,
    body: "",
    truncated: false,
  };
}

function scripted(...hops: HopResult[]) {
  const transport = vi.fn<Transport>(async () => {
    const hop = hops.shift();
    if (!hop) throw new Error("Unexpected extra hop");
    return hop;
  });
  return transport;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchSafely", () => {
  it("should return the page when the url is public", async () => {
    const transport = scripted(page("hello"));

    const result = await fetchSafely("https://example.com/a", { transport });

    expect(result).toEqual({
      ok: true,
      status: 200,
      finalUrl: "https://example.com/a",
      contentType: "text/html",
      body: "hello",
      truncated: false,
    });
  });

  it.each([["file:///etc/passwd"], ["ftp://example.com/"], ["gopher://a.b/"]])(
    "should refuse %s when the scheme is not http or https",
    async (url) => {
      const transport = scripted();

      const result = await fetchSafely(url, { transport });

      expect(result).toEqual({ ok: false, reason: "blocked_scheme" });
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it.each([["not a url"], [""], ["example.com"]])(
    "should refuse %j when it is not a valid url",
    async (url) => {
      const transport = scripted();

      const result = await fetchSafely(url, { transport });

      expect(result).toEqual({ ok: false, reason: "invalid_url" });
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["https://user:pw@example.com/"],
    ["https://user@example.com/"],
    ["https://:pw@example.com/"],
  ])("should refuse %s when it carries credentials", async (url) => {
    const transport = scripted();

    const result = await fetchSafely(url, { transport });

    expect(result).toEqual({ ok: false, reason: "invalid_url" });
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    ["http://127.0.0.1/"],
    ["http://127.1/"],
    ["http://2130706433/"],
    ["http://0x7f.0.0.1/"],
    ["http://0177.0.0.1/"],
    ["http://10.1.2.3:8080/"],
    ["http://169.254.169.254/latest/meta-data/"],
    ["http://[::1]/"],
    ["http://[::ffff:127.0.0.1]/"],
    ["http://[fd00::1]/"],
  ])("should refuse %s when the host is an internal IP", async (url) => {
    const transport = scripted();

    const result = await fetchSafely(url, { transport });

    expect(result).toEqual({ ok: false, reason: "blocked_address" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("should allow any port when the host is public", async () => {
    const transport = scripted(page());

    const result = await fetchSafely("http://example.com:8080/", { transport });

    expect(result.ok).toBe(true);
  });

  it("should follow the redirect when the target is public", async () => {
    const transport = scripted(redirect("https://b.example/next"), page());

    const result = await fetchSafely("https://a.example/", { transport });

    expect(result).toMatchObject({
      ok: true,
      finalUrl: "https://b.example/next",
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("should resolve the location when it is relative", async () => {
    const transport = scripted(redirect("../c"), page());

    const result = await fetchSafely("https://a.example/x/y/z", { transport });

    expect(result).toMatchObject({ finalUrl: "https://a.example/x/c" });
  });

  it.each([
    ["http://127.0.0.1/admin"],
    ["http://169.254.169.254/latest/meta-data/"],
    ["http://[::1]:8080/"],
    ["//10.0.0.1/"],
  ])("should stop when a redirect points at %s", async (location) => {
    const transport = scripted(redirect(location));

    const result = await fetchSafely("https://a.example/", { transport });

    expect(result).toEqual({ ok: false, reason: "blocked_address" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("should stop when a later redirect points at an internal IP", async () => {
    const transport = scripted(
      redirect("https://b.example/"),
      redirect("https://c.example/"),
      redirect("http://192.168.0.1/"),
    );

    const result = await fetchSafely("https://a.example/", { transport });

    expect(result).toEqual({ ok: false, reason: "blocked_address" });
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it("should stop when a redirect points at another scheme", async () => {
    const transport = scripted(redirect("file:///etc/passwd"));

    const result = await fetchSafely("https://a.example/", { transport });

    expect(result).toEqual({ ok: false, reason: "blocked_scheme" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("should stop when a redirect location is not a valid url", async () => {
    const transport = scripted(redirect("http://"));

    const result = await fetchSafely("https://a.example/", { transport });

    expect(result).toEqual({ ok: false, reason: "invalid_url" });
  });

  it("should accept five redirects when the sixth hop is the page", async () => {
    const transport = scripted(
      ...Array.from({ length: 5 }, (_, i) =>
        redirect(`https://a.example/${i}`),
      ),
      page(),
    );

    const result = await fetchSafely("https://a.example/", { transport });

    expect(result.ok).toBe(true);
    expect(transport).toHaveBeenCalledTimes(6);
  });

  it("should stop when there are more than five redirects", async () => {
    const transport = vi.fn<Transport>(async () =>
      redirect("https://a.example/loop"),
    );

    const result = await fetchSafely("https://a.example/loop", { transport });

    expect(result).toEqual({ ok: false, reason: "too_many_redirects" });
    expect(transport).toHaveBeenCalledTimes(6);
  });

  it("should pass the failure on when the transport fails", async () => {
    const transport = scripted({ ok: false, reason: "network_error" });

    const result = await fetchSafely("https://a.example/", { transport });

    expect(result).toEqual({ ok: false, reason: "network_error" });
  });

  it("should use a five second deadline when no timeout is given", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");

    await fetchSafely("https://a.example/", { transport: scripted(page()) });

    expect(TIMEOUT_MS).toBe(5000);
    expect(timeout).toHaveBeenCalledExactlyOnceWith(5000);
  });

  it("should share one deadline when a chain has several redirects", async () => {
    const signals: AbortSignal[] = [];
    const transport = vi.fn<Transport>(async (_url, signal) => {
      signals.push(signal);
      return signals.length < 3 ? redirect("https://a.example/next") : page();
    });

    await fetchSafely("https://a.example/", { transport });

    expect(new Set(signals).size).toBe(1);
  });

  it("should block without connecting when the default transport meets localhost", async () => {
    const connection = vi.fn();
    const server = createServer((_req, res) => res.end());
    server.on("connection", connection);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;

    const result = await fetchSafely(`http://localhost:${port}/`);
    await new Promise((resolve) => server.close(resolve));

    expect(result).toEqual({ ok: false, reason: "blocked_address" });
    expect(connection).not.toHaveBeenCalled();
  });
});
