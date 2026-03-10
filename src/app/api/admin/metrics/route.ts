import { NextResponse, type NextRequest } from "next/server";

import { requireAdminApiAuth } from "@/server/admin-auth";
import { getMetricsSnapshot } from "@/server/metrics-store";

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminApiAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  const metrics = await getMetricsSnapshot();
  return NextResponse.json({ ok: true, metrics });
}
