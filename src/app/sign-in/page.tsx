import Image from "next/image";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { safeNextPath } from "@/lib/auth/routes";
import { getUserId } from "@/lib/auth/session";
import { signInWithGoogle } from "./actions";

export default async function SignIn({ searchParams }: PageProps<"/sign-in">) {
  const { next, error } = await searchParams;
  const nextPath = safeNextPath(next);

  if (await getUserId()) redirect(nextPath);

  const t = await getTranslations("signIn");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4">
      <Image src="/logo.svg" alt="" width={48} height={48} priority />
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {error ? (
        <p role="alert" className="text-destructive">
          {t("error")}
        </p>
      ) : null}
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={nextPath} />
        <Button type="submit" className="w-full">
          {t("google")}
        </Button>
      </form>
    </main>
  );
}
