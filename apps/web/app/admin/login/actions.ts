"use server";

import { redirect } from "next/navigation";
import { AuthError } from "@restaurant/shared";
import { clearSessionCookie, getAuthService, setSessionCookie, currentStaff } from "../../../lib/auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const auth = getAuthService();
  try {
    const result = await auth.login({ email, password });
    // Staff-only area: customer accounts cannot sign in here.
    if (result.user.kind !== "STAFF") throw new AuthError("INVALID_CREDENTIALS");
    const ttl = 30 * 24 * 60 * 60 * 1000;
    await setSessionCookie(result.token, new Date(Date.now() + ttl));
  } catch (e) {
    if (!(e instanceof AuthError)) console.error("staff login failed", e);
    const code = e instanceof AuthError ? e.code : "UNKNOWN";
    redirect(`/admin/login?error=${encodeURIComponent(code)}`);
  }
  redirect("/admin");
}

export async function logoutAction() {
  const staff = await currentStaff();
  if (staff) await getAuthService().logout(staff.sessionId);
  await clearSessionCookie();
  redirect("/admin/login");
}
