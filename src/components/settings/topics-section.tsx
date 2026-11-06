import { useTranslations } from "next-intl";
import { TopicRow } from "./topic-row";

type Topic = { id: string; name: string; color: string; resourceCount: number };

export function TopicsSection({ topics }: { topics: Topic[] }) {
  const t = useTranslations("settings");

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{t("topics")}</h2>
      {topics.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          {t("noTopics")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {topics.map((topic) => (
            <TopicRow key={topic.id} topic={topic} />
          ))}
        </ul>
      )}
    </section>
  );
}
