import { CircleAlertIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { TimezoneField } from "@/components/timezone-field";
import { safeNextPath } from "@/lib/auth/routes";
import { getUserId } from "@/lib/auth/session";
import { signInWithGoogle } from "./actions";

// The redirect target comes from the URL, so this page waits for the request.
export const instant = false;

export default async function SignIn({ searchParams }: PageProps<"/sign-in">) {
  const { next, error } = await searchParams;
  const nextPath = safeNextPath(next);

  if (await getUserId()) redirect(nextPath);

  const t = await getTranslations("signIn");

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-6">
      <div className="flex w-full max-w-100 flex-1 flex-col justify-center gap-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Image src="/logo.svg" alt="" width={32} height={32} priority />
          {t("brand")}
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("body")}</p>
        </div>
        <div className="flex flex-col gap-3">
          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive-soft p-3 text-sm text-destructive-soft-foreground"
            >
              <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t("error")}
            </p>
          ) : null}
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={nextPath} />
            <TimezoneField />
            <GoogleSignInButton />
          </form>
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-4 text-sm">
        <LanguageSwitcher />
        <Link href="/terms" className="underline underline-offset-4">
          {t("terms")}
        </Link>
        <Link href="/privacy" className="underline underline-offset-4">
          {t("privacy")}
        </Link>
      </footer>
    </main>
  );
}
