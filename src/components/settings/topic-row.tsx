"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  removeTopic,
  type SaveTopicResult,
  saveTopic,
} from "@/app/(app)/settings/topic-actions";
import { TopicDot } from "@/components/topic-dot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MAX_TOPIC_NAME_LENGTH, TOPIC_COLORS } from "@/domain/topic-limits";

type Topic = { id: string; name: string; color: string; resourceCount: number };

const errorMessages = {
  duplicate: "topicDuplicate",
  invalid_name: "topicInvalidName",
  failed: "saveFailed",
} as const;

export function TopicRow({ topic }: { topic: Topic }) {
  const t = useTranslations("settings");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(topic.name);
  const [color, setColor] = useState(topic.color);
  const [error, setError] = useState<Exclude<SaveTopicResult, "saved"> | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [busy, startAction] = useTransition();

  function cancel() {
    setName(topic.name);
    setColor(topic.color);
    setError(null);
    setEditing(false);
  }

  function save() {
    startAction(async () => {
      const result = await saveTopic(topic.id, { name, color }).catch(
        (): SaveTopicResult => "failed",
      );
      if (result === "saved") {
        setError(null);
        setEditing(false);
      } else {
        setError(result);
      }
    });
  }

  function confirmDelete() {
    startAction(async () => {
      const deleted = await removeTopic(topic.id).catch(() => false);
      setDeleteFailed(!deleted);
      if (deleted) setConfirmOpen(false);
    });
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 p-3">
        <Input
          aria-label={t("topicName")}
          aria-invalid={error !== null}
          maxLength={MAX_TOPIC_NAME_LENGTH}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div role="group" aria-label={t("topicColor")} className="flex gap-1">
          {TOPIC_COLORS.map((option, index) => (
            <button
              key={option}
              type="button"
              aria-label={t("topicColorOption", { number: index + 1 })}
              aria-pressed={color === option}
              className="flex size-8 items-center justify-center rounded-md border border-transparent aria-pressed:border-ring"
              onClick={() => setColor(option)}
            >
              <TopicDot color={option} />
            </button>
          ))}
        </div>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {t(errorMessages[error])}
          </p>
        ) : null}
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={cancel}>
            {t("cancel")}
          </Button>
          <Button size="sm" disabled={busy} onClick={save}>
            {t("save")}
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 p-3">
      <TopicDot color={topic.color} />
      <span className="min-w-0 flex-1 truncate text-sm">{topic.name}</span>
      <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
        {t("edit")}
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            {t("delete")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("topicDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("topicDeleteBody", { count: topic.resourceCount })}
            </DialogDescription>
          </DialogHeader>
          {deleteFailed ? (
            <p role="alert" className="text-sm text-destructive">
              {t("saveFailed")}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={confirmDelete}
            >
              {t("topicDeleteAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
