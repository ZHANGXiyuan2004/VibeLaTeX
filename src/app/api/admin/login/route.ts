import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ADMIN_COOKIE_NAME,
  getExpectedAdminToken,
  isAdminProtectionEnabled,
  validateAdminPassword,
} from "@/server/admin-auth";

const loginSchema = z.object({
  password: z.string(),
});

export async function POST(request: Request) {
  if (!isAdminProtectionEnabled()) {
    return NextResponse.json({
      ok: true,
      message: "Admin protection disabled.",
    });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success || !validateAdminPassword(parsed.data.password)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid admin password.",
      },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: getExpectedAdminToken(),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
