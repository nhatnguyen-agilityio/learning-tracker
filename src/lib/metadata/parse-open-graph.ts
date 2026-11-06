import { Parser } from "htmlparser2";

// These tags live in the head, so the rest of a large page is never parsed.
export const MAX_PARSED_CHARACTERS = 128 * 1024;

export type PageTags = {
  title: string | null;
  image: string | null;
  ogType: string | null;
};

function clean(value: string | undefined): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  return text || null;
}

/** Reads the tags that describe a page. Open Graph wins over the title tag. */
export function parseOpenGraph(html: string): PageTags {
  const og: Record<string, string> = {};
  let titleTag = "";
  let inTitle = false;
  let titleDone = false;

  const parser = new Parser({
    onopentag(name, attributes) {
      if (name === "title" && !titleDone) inTitle = true;

      const property = attributes.property?.toLowerCase();
      if (name === "meta" && property?.startsWith("og:")) {
        og[property] ??= attributes.content ?? "";
      }
    },
    ontext(text) {
      if (inTitle) titleTag += text;
    },
    onclosetag(name) {
      if (name === "title" && inTitle) {
        inTitle = false;
        titleDone = true;
      }
    },
  });
  parser.write(html.slice(0, MAX_PARSED_CHARACTERS));
  parser.end();

  return {
    title: clean(og["og:title"]) ?? clean(titleTag),
    image: clean(og["og:image"]),
    ogType: clean(og["og:type"])?.toLowerCase() ?? null,
  };
}
