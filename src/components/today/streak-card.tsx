import { useTranslations } from "next-intl";

export function StreakCard({
  streak,
  recentDays,
}: {
  streak: number;
  recentDays: boolean[];
}) {
  const t = useTranslations("today");
  const lastIndex = recentDays.length - 1;

  return (
    <section className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4">
      <p className="text-sm">
        {streak > 0 ? t("streak", { count: streak }) : t("noStreak")}
      </p>
      <span aria-hidden className="inline-flex items-center gap-1">
        {recentDays.map((reviewed, index) => (
          <span
            key={index}
            className={`size-2.5 rounded-sm ${reviewed ? "bg-primary" : "bg-muted"} ${index === lastIndex ? "outline-2 outline-offset-1 outline-primary" : ""}`}
          />
        ))}
      </span>
    </section>
  );
}
