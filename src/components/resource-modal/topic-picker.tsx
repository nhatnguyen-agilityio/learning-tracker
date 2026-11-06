"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { addTopic } from "@/app/(app)/library/actions";
import { TopicDot } from "@/components/topic-dot";

export type TopicOption = { id: string; name: string; color: string };

type TopicPickerProps = {
  topics: TopicOption[];
  picked: TopicOption[];
  onChange: (picked: TopicOption[]) => void;
  onTopicCreated: (topic: TopicOption) => void;
  onCreatingChange: (creating: boolean) => void;
};

export function TopicPicker({
  topics,
  picked,
  onChange,
  onTopicCreated,
  onCreatingChange,
}: TopicPickerProps) {
  const t = useTranslations("resourceForm");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const trimmed = query.trim();
  const pickedIds = new Set(picked.map((topic) => topic.id));
  const options = topics.filter(
    (topic) =>
      !pickedIds.has(topic.id) &&
      topic.name.toLowerCase().includes(trimmed.toLowerCase()),
  );
  const exists = topics.some(
    (topic) => topic.name.toLowerCase() === trimmed.toLowerCase(),
  );

  function pick(topic: TopicOption) {
    onChange([...picked, topic]);
    setQuery("");
  }

  function create() {
    onCreatingChange(true);
    startTransition(async () => {
      const result = await addTopic(trimmed);
      onCreatingChange(false);
      if (result.kind !== "created" && result.kind !== "duplicate") return;

      onTopicCreated(result.topic);
      pick(result.topic);
    });
  }

  return (
    <div className="relative">
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input px-2 py-1">
        {picked.map((topic) => (
          <span
            key={topic.id}
            className="flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-sm"
          >
            <TopicDot color={topic.color} />
            {topic.name}
            <button
              type="button"
              aria-label={t("removeTopic", { name: topic.name })}
              onClick={() =>
                onChange(picked.filter((item) => item.id !== topic.id))
              }
            >
              <XIcon aria-hidden className="size-3" />
            </button>
          </span>
        ))}
        <input
          id="resource-topics"
          role="combobox"
          aria-expanded={open}
          aria-controls="resource-topic-list"
          className="min-w-32 flex-1 bg-transparent py-1 text-sm outline-none"
          placeholder={t("topicPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (options[0]) pick(options[0]);
            else if (trimmed && !exists) create();
          }}
        />
      </div>
      {open && (options.length > 0 || (trimmed && !exists)) ? (
        <div
          id="resource-topic-list"
          role="listbox"
          className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-card p-1 shadow-md"
        >
          {options.map((topic) => (
            <button
              key={topic.id}
              type="button"
              role="option"
              aria-selected={false}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(topic)}
            >
              <TopicDot color={topic.color} />
              {topic.name}
            </button>
          ))}
          {trimmed && !exists ? (
            <button
              type="button"
              disabled={pending}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              onMouseDown={(event) => event.preventDefault()}
              onClick={create}
            >
              <PlusIcon aria-hidden className="size-4" />
              {t("createTopic", { name: trimmed })}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
