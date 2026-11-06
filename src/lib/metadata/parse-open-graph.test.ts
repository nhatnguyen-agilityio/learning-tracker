import { describe, expect, it } from "vitest";
import { MAX_PARSED_CHARACTERS, parseOpenGraph } from "./parse-open-graph";

describe("parseOpenGraph", () => {
  it("should read the title and image when a page has Open Graph tags", () => {
    const html = `<head>
      <title>Plain title</title>
      <meta property="og:title" content="Rich title">
      <meta property="og:image" content="https://example.test/a.png">
      <meta property="og:type" content="Article">
    </head>`;

    expect(parseOpenGraph(html)).toEqual({
      title: "Rich title",
      image: "https://example.test/a.png",
      ogType: "article",
    });
  });

  it("should fall back to the title tag when Open Graph is missing", () => {
    expect(parseOpenGraph("<title>  Plain\n title </title>").title).toBe(
      "Plain title",
    );
  });

  it("should decode entities when a title has them", () => {
    expect(parseOpenGraph("<title>Tom &amp; Jerry</title>").title).toBe(
      "Tom & Jerry",
    );
  });

  it("should keep the page title when an inline SVG has its own title", () => {
    const html = "<title>Page</title><svg><title>Icon</title></svg>";

    expect(parseOpenGraph(html).title).toBe("Page");
  });

  it("should return empty metadata when the HTML has no useful tags", () => {
    expect(parseOpenGraph("<p>Hello</p>")).toEqual({
      title: null,
      image: null,
      ogType: null,
    });
  });

  it("should ignore tags when they come after the parsed part of the page", () => {
    const html = `${" ".repeat(MAX_PARSED_CHARACTERS)}<title>Too late</title>`;

    expect(parseOpenGraph(html).title).toBeNull();
  });

  it("should still read the tags when the HTML is broken", () => {
    const html = `<title>Kept</title><div><meta property="og:image" content="/a.png"`;

    expect(parseOpenGraph(html).title).toBe("Kept");
  });
});
