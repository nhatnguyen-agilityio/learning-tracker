import { cookies } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NewCardsField } from "@/components/settings/new-cards-field";
import { TimezoneSelect } from "@/components/settings/timezone-select";
import { TopicsSection } from "@/components/settings/topics-section";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { DEFAULT_TIMEZONE } from "@/domain/timezone";
import { listTopicsWithUsage } from "@/domain/topics";
import { getUserSettings } from "@/domain/user-settings";
import { signOut } from "@/lib/auth/actions";
import { requireUserId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { resolveTheme, THEME_COOKIE } from "@/lib/theme/theme";

// Every signed-in page depends on the request, so it waits for the server.
export const instant = false;

export default async function Settings() {
  const userId = await requireUserId();
  const db = getDb();
  const [t, tNav, tLegal, cookieStore, settings, topics] = await Promise.all([
    getTranslations("settings"),
    getTranslations("nav"),
    getTranslations("legal"),
    cookies(),
    getUserSettings(db, userId),
    listTopicsWithUsage(db, userId),
  ]);
  const theme = resolveTheme(cookieStore.get(THEME_COOKIE)?.value);
  const timezone = settings?.timezone ?? DEFAULT_TIMEZONE;

  return (
    <>
      <h1 className="text-2xl font-semibold">{tNav("settings")}</h1>
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <h2 className="font-semibold">{t("learning")}</h2>
        <NewCardsField initialValue={settings?.newCardsPerDay ?? 20} />
        <TimezoneSelect
          current={timezone}
          timezones={Intl.supportedValuesOf("timeZone")}
        />
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("language")}</h3>
          <LanguageSwitcher />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("appearance")}</h3>
          <ThemeSwitcher current={theme} />
        </div>
      </section>
      <TopicsSection topics={topics} />
      <section className="flex flex-col items-start gap-2">
        <h2 className="font-semibold">{t("yourData")}</h2>
        <p className="text-sm text-muted-foreground">{t("exportHint")}</p>
        <Button asChild variant="secondary">
          <a href="/api/export" download>
            {t("export")}
          </a>
        </Button>
      </section>
      <nav aria-label={tLegal("tabs")} className="flex gap-4 text-sm">
        <Link href="/terms" className="underline underline-offset-4">
          {tLegal("terms")}
        </Link>
        <Link href="/privacy" className="underline underline-offset-4">
          {tLegal("privacy")}
        </Link>
      </nav>
      <form action={signOut}>
        <Button type="submit" variant="secondary">
          {t("signOut")}
        </Button>
      </form>
    </>
  );
}
