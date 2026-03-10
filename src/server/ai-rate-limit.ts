import { randomUUID } from "node:crypto";

export const AI_SESSION_COOKIE_NAME = "vibelatex_session";

interface RateLimitBucket {
  count: number;
  reset_at: number;
}

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  reset_at: number;
  reason?: "ip" | "session";
}

const buckets = new Map<string, RateLimitBucket>();

function readIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.round(parsed);
}

function getRateLimitPolicy(): { windowMs: number; maxRequests: number } {
  return {
    windowMs: readIntFromEnv("AI_RATE_LIMIT_WINDOW_MS", 60_000),
    maxRequests: readIntFromEnv("AI_RATE_LIMIT_MAX_REQUESTS", 30),
  };
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const output: Record<string, string> = {};

  for (const segment of cookieHeader.split(";")) {
    const [name, ...rest] = segment.trim().split("=");
    if (!name || rest.length === 0) {
      continue;
    }
    output[name] = decodeURIComponent(rest.join("="));
  }

  return output;
}

function getOrCreateBucket(key: string, now: number, windowMs: number): RateLimitBucket {
  const current = buckets.get(key);
  if (!current || now >= current.reset_at) {
    const fresh: RateLimitBucket = {
      count: 0,
      reset_at: now + windowMs,
    };
    buckets.set(key, fresh);
    return fresh;
  }

  return current;
}

function cleanupExpiredBuckets(now: number): void {
  if (buckets.size < 512) {
    return;
  }

  for (const [key, bucket] of buckets.entries()) {
    if (now >= bucket.reset_at) {
      buckets.delete(key);
    }
  }
}

export function getOrCreateAiSession(request: Request): {
  sessionId: string;
  setCookieHeader?: string;
} {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = parseCookieHeader(cookieHeader);
  const existing = cookies[AI_SESSION_COOKIE_NAME]?.trim();

  if (existing) {
    return {
      sessionId: existing,
    };
  }

  const sessionId = randomUUID();
  return {
    sessionId,
    setCookieHeader: `${AI_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
  };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) {
    return cfIp;
  }

  return "unknown";
}

export function consumeAiRateLimit(input: {
  ip: string;
  sessionId: string;
  now?: number;
}): RateLimitResult {
  const now = input.now ?? Date.now();
  const { maxRequests, windowMs } = getRateLimitPolicy();
  cleanupExpiredBuckets(now);

  const ipKey = `ip:${input.ip || "unknown"}`;
  const sessionKey = `session:${input.sessionId || "unknown"}`;

  const ipBucket = getOrCreateBucket(ipKey, now, windowMs);
  const sessionBucket = getOrCreateBucket(sessionKey, now, windowMs);

  if (ipBucket.count >= maxRequests) {
    return {
      ok: false,
      remaining: 0,
      reset_at: ipBucket.reset_at,
      reason: "ip",
    };
  }

  if (sessionBucket.count >= maxRequests) {
    return {
      ok: false,
      remaining: 0,
      reset_at: sessionBucket.reset_at,
      reason: "session",
    };
  }

  ipBucket.count += 1;
  sessionBucket.count += 1;

  const remaining = Math.max(
    0,
    Math.min(maxRequests - ipBucket.count, maxRequests - sessionBucket.count),
  );

  return {
    ok: true,
    remaining,
    reset_at: Math.min(ipBucket.reset_at, sessionBucket.reset_at),
  };
}

export function clearAiRateLimitForTests(): void {
  buckets.clear();
}
