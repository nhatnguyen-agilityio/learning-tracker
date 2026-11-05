import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { setLocale } from "@/lib/i18n/actions";
import { locales } from "@/lib/i18n/locale";

export function LanguageSwitcher() {
  const currentLocale = useLocale();
  const t = useTranslations("language");

  return (
    <div role="group" aria-label={t("label")} className="flex gap-2">
      {locales.map((locale) => (
        <form key={locale} action={setLocale.bind(null, locale)}>
          <Button
            type="submit"
            size="sm"
            variant={locale === currentLocale ? "secondary" : "ghost"}
            aria-pressed={locale === currentLocale}
          >
            {t(locale)}
          </Button>
        </form>
      ))}
    </div>
  );
}
