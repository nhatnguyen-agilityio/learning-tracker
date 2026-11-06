import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { SessionSummary } from "@/lib/review-session/session";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-3">
      <strong className="text-2xl font-semibold">{value}</strong>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

const SEGMENTS = [
  { rating: "remembered", className: "bg-success" },
  { rating: "vaguely", className: "bg-warning" },
  { rating: "forgot", className: "bg-destructive" },
] as const;

export function ReviewSummary({
  summary,
  remaining,
  pending,
  loading,
  loadFailed,
  onContinue,
}: {
  summary: SessionSummary;
  remaining: number;
  pending: number;
  loading: boolean;
  loadFailed: boolean;
  onContinue: () => void;
}) {
  const t = useTranslations("review");
  const hasMore = remaining > 0;

  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      <div>
        <h2 className="text-2xl font-semibold">
          {t(hasMore ? "batchTitle" : "doneTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {hasMore ? t("batchBody", { count: remaining }) : t("doneBody")}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat value={`${summary.reviewed}`} label={t("statCards")} />
        <Stat value={`${summary.recallRate}%`} label={t("statRate")} />
        <Stat value="—" label={t("statStreak")} />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
        <div aria-hidden className="flex h-2 overflow-hidden rounded-full">
          {SEGMENTS.map(({ rating, className }) => (
            <span
              key={rating}
              className={className}
              style={{
                width: `${(summary[rating] / summary.reviewed) * 100}%`,
              }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {SEGMENTS.map(({ rating, className }) => (
            <span key={rating} className="flex items-center gap-1">
              <i aria-hidden className={`size-2 rounded-full ${className}`} />
              {t(rating)} {summary[rating]}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("rateNote")}</p>
      </div>
      {loadFailed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("batchFailed")}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        {hasMore ? (
          <Button
            size="lg"
            className="w-full"
            disabled={pending > 0 || loading}
            onClick={onContinue}
          >
            {t("keepReviewing")}
          </Button>
        ) : null}
        <Button
          asChild
          size="lg"
          variant={hasMore ? "secondary" : "default"}
          className="w-full"
        >
          <Link href="/">{t("backToday")}</Link>
        </Button>
      </div>
    </div>
  );
}
