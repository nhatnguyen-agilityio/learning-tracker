import { describe, expect, it, vi } from "vitest";
import { MAX_TITLE_LENGTH } from "@/domain/resources";
import type { SafeFetchResult } from "@/lib/safe-fetch/fetch-safely";
import { fetchMetadata } from "./fetch-metadata";

function page(body: string, overrides: Partial<SafeFetchResult> = {}) {
  return async () =>
    ({
      ok: true,
      status: 200,
      finalUrl: "https://example.test/final/page",
      contentType: "text/html; charset=utf-8",
      body,
      truncated: false,
      ...overrides,
    }) as SafeFetchResult;
}

const empty = { title: null, thumbnailUrl: null, type: "other" };

describe("fetchMetadata", () => {
  it("should read the page when the link is a normal site", async () => {
    const html = `<meta property="og:title" content="Guide">
      <meta property="og:image" content="https://cdn.test/a.png">
      <meta property="og:type" content="article">`;

    expect(await fetchMetadata("https://example.test/a", page(html))).toEqual({
      title: "Guide",
      thumbnailUrl: "https://cdn.test/a.png",
      type: "article",
    });
  });

  it("should make the image absolute when its link is relative", async () => {
    const html = `<meta property="og:image" content="../a.png">`;

    const { thumbnailUrl } = await fetchMetadata(
      "https://example.test/a",
      page(html),
    );

    expect(thumbnailUrl).toBe("https://example.test/a.png");
  });

  it.each(["javascript:alert(1)", "data:image/png;base64,AAAA"])(
    "should drop the image when its link is not http or https: %s",
    async (image) => {
      const html = `<meta property="og:image" content="${image}">`;

      const { thumbnailUrl } = await fetchMetadata(
        "https://example.test/a",
        page(html),
      );

      expect(thumbnailUrl).toBeNull();
    },
  );

  it("should cut the title when it is too long", async () => {
    const html = `<title>${"a".repeat(MAX_TITLE_LENGTH + 10)}</title>`;

    const { title } = await fetchMetadata("https://example.test/a", page(html));

    expect(title).toHaveLength(MAX_TITLE_LENGTH);
  });

  it("should use oEmbed when the link is a YouTube video", async () => {
    const fetcher = vi.fn(
      page(
        JSON.stringify({
          title: "A talk",
          thumbnail_url: "https://i.ytimg.test/a.jpg",
        }),
        { contentType: "application/json" },
      ),
    );

    const metadata = await fetchMetadata(
      "https://www.youtube.com/watch?v=abc",
      fetcher,
    );

    expect(metadata).toEqual({
      title: "A talk",
      thumbnailUrl: "https://i.ytimg.test/a.jpg",
      type: "video",
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/www\.youtube\.com\/oembed\?/),
    );
  });

  it("should keep the video type when YouTube gives no metadata", async () => {
    const metadata = await fetchMetadata(
      "https://youtu.be/abc",
      page("not json"),
    );

    expect(metadata).toEqual({
      title: null,
      thumbnailUrl: null,
      type: "video",
    });
  });

  it("should return empty metadata when the fetch fails", async () => {
    const failed = async () =>
      ({ ok: false, reason: "blocked_address" }) as SafeFetchResult;

    expect(await fetchMetadata("https://example.test/a", failed)).toEqual(
      empty,
    );
  });

  it("should return empty metadata when the page returns an error", async () => {
    const fetcher = page("<title>Not found</title>", { status: 404 });

    expect(await fetchMetadata("https://example.test/a", fetcher)).toEqual(
      empty,
    );
  });

  it("should return empty metadata when the link is not a web page", async () => {
    const fetcher = page("%PDF", { contentType: "application/pdf" });

    expect(await fetchMetadata("https://example.test/a.pdf", fetcher)).toEqual(
      empty,
    );
  });

  it("should return empty metadata when the link can't be parsed", async () => {
    expect(await fetchMetadata("not a link", page(""))).toEqual(empty);
  });
});
