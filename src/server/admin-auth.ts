import { createHash } from "node:crypto";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "vibelatex_admin";

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

export function isAdminProtectionEnabled(): boolean {
  return getAdminPassword().length > 0;
}

function buildAdminToken(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export function getExpectedAdminToken(): string {
  return buildAdminToken(getAdminPassword());
}

export function isAdminTokenValid(token?: string): boolean {
  if (!isAdminProtectionEnabled()) {
    return true;
  }

  if (!token) {
    return false;
  }

  return token === getExpectedAdminToken();
}

export function validateAdminPassword(password: string): boolean {
  if (!isAdminProtectionEnabled()) {
    return true;
  }

  return password === getAdminPassword();
}

export function requireAdminApiAuth(request: NextRequest): NextResponse | null {
  if (!isAdminProtectionEnabled()) {
    return null;
  }

  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (isAdminTokenValid(token)) {
    return null;
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Admin authentication required.",
    },
    { status: 401 },
  );
}
