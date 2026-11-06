"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type FormEvent, useState, useTransition } from "react";
import {
  editResource,
  lookupLink,
  type ResourceFormValues,
  saveResource,
} from "@/app/(app)/library/actions";
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
import { Label } from "@/components/ui/label";
import { ResourceThumbnail } from "./resource-thumbnail";
import { type TopicOption, TopicPicker } from "./topic-picker";

const RESOURCE_TYPES = ["article", "video", "course", "doc", "other"] as const;
const RESOURCE_STATUSES = ["want", "learning", "done"] as const;

type Step = "link" | "fetching" | "duplicate" | "details";

type EditableResource = Omit<ResourceFormValues, "topicIds"> & {
  id: string;
  topics: TopicOption[];
};

type ResourceModalProps = {
  topics: TopicOption[];
  /** Opens the modal in edit mode, with the link locked. */
  resource?: EditableResource;
  triggerLabel?: string;
};

export function ResourceModal({
  topics,
  resource,
  triggerLabel,
}: ResourceModalProps) {
  const t = useTranslations("resourceForm");
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setFormKey((key) => key + 1);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>{triggerLabel ?? t("add")}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{resource ? t("edit") : t("add")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("linkHint")}
          </DialogDescription>
        </DialogHeader>
        <ResourceForm
          key={formKey}
          topics={topics}
          resource={resource}
          onClose={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  labelFor,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  labelFor: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={option === value ? "secondary" : "ghost"}
            aria-pressed={option === value}
            onClick={() => onChange(option)}
          >
            {labelFor(option)}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ResourceForm({
  topics,
  resource,
  onClose,
}: {
  topics: TopicOption[];
  resource?: EditableResource;
  onClose: () => void;
}) {
  const t = useTranslations("resourceForm");
  const [step, setStep] = useState<Step>(resource ? "details" : "link");
  const [url, setUrl] = useState(resource?.url ?? "");
  const [checkedUrl, setCheckedUrl] = useState("");
  const [urlError, setUrlError] = useState(false);
  const [duplicate, setDuplicate] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [metadataFailed, setMetadataFailed] = useState(false);
  const [title, setTitle] = useState(resource?.title ?? "");
  const [titleError, setTitleError] = useState(false);
  const [type, setType] = useState(resource?.type ?? "other");
  const [thumbnailUrl, setThumbnailUrl] = useState(
    resource?.thumbnailUrl ?? null,
  );
  const [status, setStatus] = useState(resource?.status ?? "want");
  const [createdTopics, setCreatedTopics] = useState<TopicOption[]>([]);
  const [picked, setPicked] = useState(resource?.topics ?? []);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, startSaving] = useTransition();

  // Reads the prop on every render: Library refreshes it after a save.
  const knownIds = new Set(topics.map((topic) => topic.id));
  const allTopics = [
    ...topics,
    ...createdTopics.filter((topic) => !knownIds.has(topic.id)),
  ];

  async function checkLink() {
    const link = url.trim();
    if (!link || link === checkedUrl) return;

    setCheckedUrl(link);
    setUrlError(false);
    setDuplicate(null);
    setStep("fetching");

    const result = await lookupLink(link);
    if (result.kind === "invalid") {
      setUrlError(true);
      setStep("link");
    } else if (result.kind === "duplicate") {
      setDuplicate(result.resource);
      setStep("duplicate");
    } else {
      const { metadata } = result;
      setTitle(metadata.title ?? "");
      setType(metadata.type);
      setThumbnailUrl(metadata.thumbnailUrl);
      setMetadataFailed(!metadata.title);
      setStep("details");
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (step !== "details") return;

    if (!title.trim()) {
      setTitleError(true);
      return;
    }

    startSaving(async () => {
      const values = {
        title,
        type,
        thumbnailUrl,
        status,
        topicIds: picked.map((topic) => topic.id),
      };
      const result = resource
        ? await editResource(resource.id, values)
        : await saveResource({ ...values, url: url.trim() });

      if (result.kind === "saved") onClose();
      else if (result.kind === "invalid_title") setTitleError(true);
      else setSaveFailed(true);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="resource-url">{t("link")}</Label>
        <div className="relative">
          <Input
            id="resource-url"
            type="url"
            placeholder="https://"
            value={url}
            disabled={Boolean(resource) || step === "fetching"}
            aria-invalid={urlError}
            onChange={(event) => setUrl(event.target.value)}
            onBlur={checkLink}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || step === "details") return;
              event.preventDefault();
              void checkLink();
            }}
          />
          {step === "fetching" ? (
            <Loader2Icon
              aria-hidden
              className="absolute top-2.5 right-3 size-4 animate-spin text-muted-foreground"
            />
          ) : null}
        </div>
        <p
          className={
            urlError
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {urlError
            ? t("linkError")
            : step === "fetching"
              ? t("fetching")
              : t("linkHint")}
        </p>
      </div>

      {step === "duplicate" && duplicate ? (
        <div className="flex flex-col gap-3">
          <p
            role="alert"
            className="rounded-md bg-warning-soft p-3 text-sm text-warning-soft-foreground"
          >
            {t("duplicate")}
          </p>
          <p className="font-medium">{duplicate.title}</p>
          <Button asChild variant="outline">
            <Link href={`/library/${duplicate.id}`}>{t("openExisting")}</Link>
          </Button>
        </div>
      ) : null}

      {step === "details" ? (
        <>
          {metadataFailed ? (
            <p
              role="status"
              className="rounded-md bg-warning-soft p-3 text-sm text-warning-soft-foreground"
            >
              {t("metadataFailed")}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <ResourceThumbnail src={thumbnailUrl} />
            <span className="text-sm text-muted-foreground">
              {thumbnailUrl ? t("thumbnailFound") : t("thumbnailFallback")}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resource-title">{t("title")}</Label>
            <Input
              id="resource-title"
              placeholder={t("titlePlaceholder")}
              value={title}
              aria-invalid={titleError}
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleError(false);
              }}
            />
            {titleError ? (
              <p className="text-sm text-destructive">{t("titleError")}</p>
            ) : null}
          </div>
          <ChoiceGroup
            label={t("type")}
            options={RESOURCE_TYPES}
            value={type}
            labelFor={(option) => t(`types.${option}`)}
            onChange={setType}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="resource-topics">{t("topics")}</Label>
            <TopicPicker
              topics={allTopics}
              picked={picked}
              onChange={setPicked}
              onCreatingChange={setCreatingTopic}
              onTopicCreated={(topic) =>
                setCreatedTopics((current) => [...current, topic])
              }
            />
          </div>
          {resource ? null : (
            <ChoiceGroup
              label={t("status")}
              options={RESOURCE_STATUSES}
              value={status}
              labelFor={(option) => t(`statuses.${option}`)}
              onChange={setStatus}
            />
          )}
          {saveFailed ? (
            <p role="alert" className="text-sm text-destructive">
              {t("saveError")}
            </p>
          ) : null}
        </>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("cancel")}
        </Button>
        {step === "details" ? (
          <Button
            type="submit"
            disabled={saving || creatingTopic}
            aria-busy={saving}
          >
            {saving ? t("saving") : t("save")}
          </Button>
        ) : null}
      </DialogFooter>
    </form>
  );
}
