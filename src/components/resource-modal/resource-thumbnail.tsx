"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";

/** Images come from any site, so this uses a plain img with a fallback. */
export function ResourceThumbnail({ src }: { src: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <span
        data-testid="thumbnail-fallback"
        className="flex h-16 w-24 flex-none items-center justify-center rounded-md bg-muted text-muted-foreground"
      >
        <ImageIcon aria-hidden className="size-6" />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote hosts are unknown
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className="h-16 w-24 flex-none rounded-md object-cover"
      onError={() => setFailedSrc(src)}
    />
  );
}
