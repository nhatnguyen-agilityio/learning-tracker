import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/auth/server";
import { requireUserId } from "@/lib/auth/session";
import { isKnownRedirect, redirectHost } from "@/lib/mcp/known-clients";
import { allowConnection, denyConnection } from "./actions";

// Every signed-in page depends on the request, so it waits for the server.
export const instant = false;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-100 flex-col justify-center gap-4 p-4">
      {children}
    </main>
  );
}

export default async function Consent({
  searchParams,
}: PageProps<"/oauth/consent">) {
  await requireUserId();
  const { authorization_id: id, failed } = await searchParams;
  const t = await getTranslations("oauth");

  const authorizationId = typeof id === "string" ? id : null;
  const { data } = authorizationId
    ? await (
        await createClient()
      ).auth.oauth.getAuthorizationDetails(authorizationId)
    : { data: null };

  if (!authorizationId || !data) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">{t("invalidTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("invalidBody")}</p>
      </Shell>
    );
  }

  // Someone who already allowed this app goes straight back to it.
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  const known = isKnownRedirect(data.redirect_uri);
  const host = redirectHost(data.redirect_uri);
  const client = known ? data.client.name || t("unnamedApp") : host;

  return (
    <Shell>
      <h1 className="text-2xl font-semibold wrap-anywhere">
        {t("title", { client })}
      </h1>
      <p className="text-sm text-muted-foreground wrap-anywhere">
        {t("account", { email: data.user.email })}
      </p>
      {known ? null : (
        <div className="flex flex-col gap-1 rounded-lg bg-warning-soft p-3 text-sm text-warning-soft-foreground wrap-anywhere">
          <p className="font-medium">{t("unverifiedTitle")}</p>
          <p>
            {data.client.name
              ? t("unverifiedName", { name: data.client.name })
              : null}{" "}
            {t("unverifiedBody", { host })}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-sm">
        <p className="font-medium">{t("canTitle")}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>{t("canRead")}</li>
          <li>{t("canAdd")}</li>
          <li>{t("canPropose")}</li>
        </ul>
        <p className="text-muted-foreground">{t("cannotDelete")}</p>
      </div>
      <p className="text-xs text-muted-foreground wrap-anywhere">
        {t("returnsTo", { address: data.redirect_uri })}
      </p>
      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {t("failed")}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <form action={denyConnection.bind(null, authorizationId)}>
          <Button type="submit" variant="ghost">
            {t("deny")}
          </Button>
        </form>
        <form action={allowConnection.bind(null, authorizationId)}>
          <Button type="submit" variant={known ? "default" : "secondary"}>
            {t("allow")}
          </Button>
        </form>
      </div>
    </Shell>
  );
}
