const TRACKING_PARAM = /^(utm_.+|fbclid|gclid)$/i;
const YOUTUBE_SHARE_PARAM = "si";
const YOUTUBE_HOST = "www.youtube.com";

function comparableParams(params: URLSearchParams, isYoutube: boolean) {
  const kept = [...params].filter(
    ([key]) =>
      !TRACKING_PARAM.test(key) && !(isYoutube && key === YOUTUBE_SHARE_PARAM),
  );
  const sorted = new URLSearchParams(kept);
  sorted.sort();
  return sorted.toString();
}

/**
 * The form of a link used to compare it, never to open it: two links with the
 * same result count as the same resource. Returns null for anything that isn't
 * an http or https link.
 */
export function normalizeUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const params = new URLSearchParams(url.searchParams);
  let host = url.host;
  let path = url.pathname.replace(/\/+$/, "");

  if (url.hostname === "youtu.be" && path) {
    params.set("v", path.slice(1));
    host = YOUTUBE_HOST;
    path = "/watch";
  }

  const query = comparableParams(params, host === YOUTUBE_HOST);
  return `https://${host}${path}${query ? `?${query}` : ""}`;
}
