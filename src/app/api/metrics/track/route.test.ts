import { vi } from "vitest";

const incrementMetricMock = vi.fn();

vi.mock("@/server/metrics-store", () => ({
  incrementMetric: incrementMetricMock,
}));

describe("POST /api/metrics/track", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns bad request when payload is invalid", async () => {
    const { POST } = await import("@/app/api/metrics/track/route");
    const response = await POST(
      new Request("http://localhost/api/metrics/track", {
        method: "POST",
        body: JSON.stringify({ event: "bad" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("increments metric snapshot", async () => {
    incrementMetricMock.mockResolvedValue({ ai_calls: 3 });
    const { POST } = await import("@/app/api/metrics/track/route");

    const response = await POST(
      new Request("http://localhost/api/metrics/track", {
        method: "POST",
        body: JSON.stringify({ event: "ai_call" }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(incrementMetricMock).toHaveBeenCalledWith("ai_call");
  });
});
