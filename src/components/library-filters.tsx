"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { TopicOption } from "@/components/resource-modal/topic-picker";
import { TopicDot } from "@/components/topic-dot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SEARCH_DELAY_MS = 300;
const STATUSES = ["want", "learning", "done"] as const;

export function LibraryFilters({ topics }: { topics: TopicOption[] }) {
  const t = useTranslations("library");
  const tForm = useTranslations("resourceForm");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const status = params.get("status");
  const topic = params.get("topic");

  useEffect(() => () => clearTimeout(timer.current), []);

  function update(name: string, value: string | null) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(name, value);
    else next.delete(name);

    const search = next.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  function search(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update("q", value), SEARCH_DELAY_MS);
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        aria-label={t("search")}
        placeholder={t("searchPlaceholder")}
        value={query}
        onChange={(event) => search(event.target.value)}
      />
      <div
        role="group"
        aria-label={tForm("status")}
        className="flex flex-wrap gap-2"
      >
        <Button
          size="sm"
          variant={status ? "ghost" : "secondary"}
          aria-pressed={!status}
          onClick={() => update("status", null)}
        >
          {t("all")}
        </Button>
        {STATUSES.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={status === option ? "secondary" : "ghost"}
            aria-pressed={status === option}
            onClick={() => update("status", option)}
          >
            {tForm(`statuses.${option}`)}
          </Button>
        ))}
      </div>
      {topics.length > 0 ? (
        <div
          role="group"
          aria-label={tForm("topics")}
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {topics.map((option) => (
            <Button
              key={option.id}
              size="sm"
              variant={topic === option.id ? "secondary" : "ghost"}
              aria-pressed={topic === option.id}
              onClick={() =>
                update("topic", topic === option.id ? null : option.id)
              }
            >
              <TopicDot color={option.color} />
              <span className="max-w-40 truncate">{option.name}</span>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
