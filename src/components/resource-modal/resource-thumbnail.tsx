"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";

/** Images come from any site, so this uses a plain img with a fallback. */
export function ResourceThumbnail({
  src,
  className = "h-16 w-24",
}: {
  src: string | null;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <span
        data-testid="thumbnail-fallback"
        className={`flex flex-none items-center justify-center rounded-md bg-muted text-muted-foreground ${className}`}
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
      className={`flex-none rounded-md object-cover ${className}`}
      onError={() => setFailedSrc(src)}
    />
  );
}
