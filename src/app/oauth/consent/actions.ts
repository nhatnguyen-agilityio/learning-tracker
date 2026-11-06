"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";
import { requireUserId } from "@/lib/auth/session";

async function decide(authorizationId: string, allow: boolean) {
  await requireUserId();
  const { oauth } = (await createClient()).auth;

  const { data, error } = allow
    ? await oauth.approveAuthorization(authorizationId, {
        skipBrowserRedirect: true,
      })
    : await oauth.denyAuthorization(authorizationId, {
        skipBrowserRedirect: true,
      });

  if (error || !data) {
    redirect(`/oauth/consent?authorization_id=${authorizationId}&failed=1`);
  }
  redirect(data.redirect_url);
}

export async function allowConnection(authorizationId: string) {
  await decide(authorizationId, true);
}

export async function denyConnection(authorizationId: string) {
  await decide(authorizationId, false);
}
