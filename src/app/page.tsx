import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { requireUserId } from "@/lib/auth/session";

export default async function Home() {
  await requireUserId();
  const t = await getTranslations("home");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4">
      <Image src="/logo.svg" alt="" width={48} height={48} priority />
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("tagline")}</p>
      <LanguageSwitcher />
    </main>
  );
}
