import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { setTheme } from "@/lib/theme/actions";
import { type AppTheme, themes } from "@/lib/theme/theme";

export function ThemeSwitcher({ current }: { current: AppTheme }) {
  const t = useTranslations("settings");

  return (
    <div role="group" aria-label={t("appearance")} className="flex gap-2">
      {themes.map((theme) => (
        <form key={theme} action={setTheme.bind(null, theme)}>
          <Button
            type="submit"
            size="sm"
            variant={theme === current ? "secondary" : "ghost"}
            aria-pressed={theme === current}
          >
            {t(theme)}
          </Button>
        </form>
      ))}
    </div>
  );
}
