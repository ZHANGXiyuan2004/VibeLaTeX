import {
  clearAiRateLimitForTests,
  consumeAiRateLimit,
  getClientIp,
  getOrCreateAiSession,
} from "@/server/ai-rate-limit";

describe("ai-rate-limit", () => {
  const originalMax = process.env.AI_RATE_LIMIT_MAX_REQUESTS;
  const originalWindow = process.env.AI_RATE_LIMIT_WINDOW_MS;

  beforeEach(() => {
    clearAiRateLimitForTests();
    process.env.AI_RATE_LIMIT_MAX_REQUESTS = "2";
    process.env.AI_RATE_LIMIT_WINDOW_MS = "60000";
  });

  afterEach(() => {
    clearAiRateLimitForTests();
    if (originalMax === undefined) {
      delete process.env.AI_RATE_LIMIT_MAX_REQUESTS;
    } else {
      process.env.AI_RATE_LIMIT_MAX_REQUESTS = originalMax;
    }

    if (originalWindow === undefined) {
      delete process.env.AI_RATE_LIMIT_WINDOW_MS;
    } else {
      process.env.AI_RATE_LIMIT_WINDOW_MS = originalWindow;
    }
  });

  it("creates a session cookie when request has no session", () => {
    const session = getOrCreateAiSession(new Request("http://localhost"));
    expect(session.sessionId).toBeTruthy();
    expect(session.setCookieHeader).toContain("vibelatex_session=");
  });

  it("reuses existing session from cookie header", () => {
    const session = getOrCreateAiSession(
      new Request("http://localhost", {
        headers: {
          cookie: "vibelatex_session=test-session",
        },
      }),
    );

    expect(session.sessionId).toBe("test-session");
    expect(session.setCookieHeader).toBeUndefined();
  });

  it("enforces per-ip and per-session limits", () => {
    const first = consumeAiRateLimit({ ip: "1.1.1.1", sessionId: "session-a", now: 1000 });
    const second = consumeAiRateLimit({ ip: "1.1.1.1", sessionId: "session-a", now: 1001 });
    const third = consumeAiRateLimit({ ip: "1.1.1.1", sessionId: "session-a", now: 1002 });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    expect(third.reason).toBe("ip");
  });

  it("extracts client ip from forwarded header", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "203.0.113.8, 10.0.0.2",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.8");
  });
});
