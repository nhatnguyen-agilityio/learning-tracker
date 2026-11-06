import { useTranslations } from "next-intl";
import { NoteMarkdown } from "@/components/notes/note-markdown";

export type ReviewCardData = {
  id: string;
  front: string;
  back: string;
  resourceTitle: string | null;
};

const faceClasses =
  "col-start-1 row-start-1 flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-6 backface-hidden";

function Face({
  label,
  source,
  content,
  hidden,
  className = "",
}: {
  label: string | null;
  source: string;
  content: string;
  hidden: boolean;
  className?: string;
}) {
  return (
    <div aria-hidden={hidden} className={`${faceClasses} ${className}`}>
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="min-w-0 truncate">{source}</span>
        {label ? <span className="flex-none">{label}</span> : null}
      </div>
      <div className="flex flex-1 items-center">
        <div className="w-full">
          <NoteMarkdown content={content} />
        </div>
      </div>
    </div>
  );
}

export function ReviewCard({
  card,
  again,
  flipped,
  onFlip,
}: {
  card: ReviewCardData;
  again: boolean;
  flipped: boolean;
  onFlip: () => void;
}) {
  const t = useTranslations("review");
  const tCards = useTranslations("resourceCards");
  const source = card.resourceTitle ?? tCards("noSource");

  return (
    <div className="relative w-full perspective-[1600px]">
      {flipped ? null : (
        <button
          type="button"
          aria-label={t("flip")}
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-2 focus-visible:outline-ring"
          onClick={onFlip}
        />
      )}
      <div
        className={`grid min-h-80 transition-transform duration-300 transform-3d motion-reduce:transition-none ${flipped ? "rotate-y-180" : ""}`}
      >
        <Face
          label={again ? t("again") : null}
          source={source}
          content={card.front}
          hidden={flipped}
        />
        <Face
          label={t("answer")}
          source={source}
          content={card.back}
          hidden={!flipped}
          className="rotate-y-180"
        />
      </div>
    </div>
  );
}
