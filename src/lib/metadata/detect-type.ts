type DetectedType = "article" | "video" | "course" | "doc" | "other";

const VIDEO_HOSTS = ["youtube.com", "youtu.be"];
const COURSE_HOSTS = ["udemy.com", "coursera.org"];

function isOnHost(hostname: string, hosts: string[]) {
  return hosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

export function isYoutubeUrl(url: URL) {
  return isOnHost(url.hostname, VIDEO_HOSTS);
}

/** A first guess only: people can change the type before saving. */
export function detectType(url: URL, ogType: string | null): DetectedType {
  if (isYoutubeUrl(url)) return "video";
  if (isOnHost(url.hostname, COURSE_HOSTS)) return "course";
  if (url.hostname.startsWith("docs.")) return "doc";
  if (url.pathname.split("/").includes("docs")) return "doc";
  if (ogType?.startsWith("video")) return "video";
  if (ogType === "article") return "article";
  return "other";
}
