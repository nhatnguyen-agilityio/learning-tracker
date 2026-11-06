import { MAX_TITLE_LENGTH } from "@/domain/resources";
import {
  fetchSafely,
  type SafeFetchResult,
} from "@/lib/safe-fetch/fetch-safely";
import { detectType, isYoutubeUrl } from "./detect-type";
import { parseOpenGraph } from "./parse-open-graph";

const YOUTUBE_OEMBED = "https://www.youtube.com/oembed";

export type LinkMetadata = {
  title: string | null;
  thumbnailUrl: string | null;
  type: ReturnType<typeof detectType>;
};

type Fetcher = (url: string) => Promise<SafeFetchResult>;

function storableTitle(title: unknown): string | null {
  if (typeof title !== "string") return null;
  return title.trim().slice(0, MAX_TITLE_LENGTH) || null;
}

function absoluteImage(image: unknown, base: string): string | null {
  if (typeof image !== "string") return null;

  const url = URL.parse(image, base);
  return url?.protocol === "http:" || url?.protocol === "https:"
    ? url.href
    : null;
}

function isHtml(contentType: string | null) {
  return /^(text\/html|application\/xhtml\+xml)/i.test(contentType ?? "");
}

async function fromYoutube(url: URL, fetcher: Fetcher) {
  const endpoint = `${YOUTUBE_OEMBED}?format=json&url=${encodeURIComponent(url.href)}`;
  const response = await fetcher(endpoint);
  if (!response.ok || response.status >= 400) return {};

  try {
    const { title, thumbnail_url: image } = JSON.parse(response.body);
    return {
      title: storableTitle(title),
      thumbnailUrl: absoluteImage(image, endpoint),
    };
  } catch {
    return {};
  }
}

async function fromPage(url: URL, fetcher: Fetcher) {
  const response = await fetcher(url.href);
  const usable =
    response.ok && response.status < 400 && isHtml(response.contentType);
  if (!usable) return {};

  const tags = parseOpenGraph(response.body);
  return {
    title: storableTitle(tags.title),
    thumbnailUrl: absoluteImage(tags.image, response.finalUrl),
    ogType: tags.ogType,
  };
}

/** Never fails: a link with no usable metadata just returns empty fields. */
export async function fetchMetadata(
  link: string,
  fetcher: Fetcher = fetchSafely,
): Promise<LinkMetadata> {
  const url = URL.parse(link);
  if (!url) return { title: null, thumbnailUrl: null, type: "other" };

  const found: {
    title?: string | null;
    thumbnailUrl?: string | null;
    ogType?: string | null;
  } = isYoutubeUrl(url)
    ? await fromYoutube(url, fetcher)
    : await fromPage(url, fetcher);

  return {
    title: found.title ?? null,
    thumbnailUrl: found.thumbnailUrl ?? null,
    type: detectType(url, found.ogType ?? null),
  };
}
