import { NextResponse, type NextRequest } from "next/server";

import { requireAdminApiAuth } from "@/server/admin-auth";
import { getRecentErrors } from "@/server/error-log";

export async function GET(request: NextRequest) {
  const unauthorized = requireAdminApiAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  const limitQuery = Number(request.nextUrl.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitQuery) ? limitQuery : 100;

  return NextResponse.json({
    ok: true,
    errors: getRecentErrors(limit),
  });
}
