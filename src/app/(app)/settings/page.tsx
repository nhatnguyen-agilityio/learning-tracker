import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { requireUserId } from "@/lib/auth/session";
import { resolveTheme, THEME_COOKIE } from "@/lib/theme/theme";

// Every signed-in page depends on the request, so it waits for the server.
export const instant = false;

export default async function Settings() {
  await requireUserId();
  const [t, tNav, cookieStore] = await Promise.all([
    getTranslations("settings"),
    getTranslations("nav"),
    cookies(),
  ]);
  const theme = resolveTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <>
      <h1 className="text-2xl font-semibold">{tNav("settings")}</h1>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("language")}</h2>
        <LanguageSwitcher />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("appearance")}</h2>
        <ThemeSwitcher current={theme} />
      </section>
    </>
  );
}
