import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BackButton } from "./back-button";

const CONTACT_EMAIL = "nguyenvanducnhat@gmail.com";
const LAST_UPDATED = new Date("2026-11-06T00:00:00Z");

const SECTIONS = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;

export async function LegalPage({ page }: { page: "terms" | "privacy" }) {
  const [t, locale] = await Promise.all([
    getTranslations("legal"),
    getLocale(),
  ]);
  const updated = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(LAST_UPDATED);

  return (
    <main className="mx-auto flex w-full max-w-160 flex-col gap-4 px-4 py-6">
      <BackButton />
      <nav aria-label={t("tabs")} className="flex gap-1 border-b border-border">
        {(["terms", "privacy"] as const).map((tab) => (
          <Link
            key={tab}
            href={`/${tab}`}
            aria-current={tab === page ? "page" : undefined}
            className="border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground aria-[current=page]:border-primary aria-[current=page]:text-foreground"
          >
            {t(tab)}
          </Link>
        ))}
      </nav>
      <div>
        <h1 className="text-2xl font-semibold">{t(`${page}Title`)}</h1>
        <p className="text-sm text-muted-foreground">
          {t("updated", { date: updated })}
        </p>
      </div>
      {SECTIONS.map((section) => (
        <section key={section} className="flex flex-col gap-1">
          <h2 className="font-semibold">
            {t(`${page}Sections.${section}.title`)}
          </h2>
          <p className="text-sm">{t(`${page}Sections.${section}.body`)}</p>
        </section>
      ))}
      <section className="flex flex-col gap-1">
        <h2 className="font-semibold">{t("contactTitle")}</h2>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-sm underline underline-offset-4 wrap-anywhere"
        >
          {CONTACT_EMAIL}
        </a>
      </section>
    </main>
  );
}
