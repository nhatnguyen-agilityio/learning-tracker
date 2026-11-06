"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { disconnectApp } from "@/app/(app)/settings/connection-actions";
import { Button } from "@/components/ui/button";

type ConnectedApp = { id: string; name: string };

function AppRow({ app }: { app: ConnectedApp }) {
  const t = useTranslations("settings");
  const [failed, setFailed] = useState(false);
  const [busy, startDisconnecting] = useTransition();

  function disconnect() {
    startDisconnecting(async () => {
      const done = await disconnectApp(app.id).catch(() => false);
      setFailed(!done);
    });
  }

  return (
    <li className="flex items-center gap-2 p-3">
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {app.name}
      </span>
      {failed ? (
        <span role="alert" className="text-xs text-destructive">
          {t("saveFailed")}
        </span>
      ) : null}
      <Button variant="ghost" size="sm" disabled={busy} onClick={disconnect}>
        {t("disconnect")}
      </Button>
    </li>
  );
}

export function ConnectedApps({ apps }: { apps: ConnectedApp[] }) {
  const t = useTranslations("settings");

  if (apps.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-medium">{t("connectedApps")}</h3>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {apps.map((app) => (
          <AppRow key={app.id} app={app} />
        ))}
      </ul>
    </div>
  );
}
