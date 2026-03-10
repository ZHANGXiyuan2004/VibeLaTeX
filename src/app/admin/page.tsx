import { cookies } from "next/headers";

import { AdminLogin } from "@/components/admin-login";
import { AdminPanel } from "@/components/admin-panel";
import {
  ADMIN_COOKIE_NAME,
  isAdminProtectionEnabled,
  isAdminTokenValid,
} from "@/server/admin-auth";
import { getConfig } from "@/server/config-store";

export default async function AdminPage() {
  const adminProtected = isAdminProtectionEnabled();
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const authenticated = isAdminTokenValid(token);

  if (!authenticated) {
    return <AdminLogin />;
  }

  const config = await getConfig();

  return <AdminPanel initialConfig={config} adminProtected={adminProtected} />;
}
