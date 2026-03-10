import { NextRequest } from "next/server";
import { vi } from "vitest";

const requireAdminApiAuthMock = vi.fn();
const getMetricsSnapshotMock = vi.fn();

vi.mock("@/server/admin-auth", () => ({
  requireAdminApiAuth: requireAdminApiAuthMock,
}));

vi.mock("@/server/metrics-store", () => ({
  getMetricsSnapshot: getMetricsSnapshotMock,
}));

describe("GET /api/admin/metrics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminApiAuthMock.mockReturnValue(null);
  });

  it("returns metrics snapshot for authorized request", async () => {
    getMetricsSnapshotMock.mockResolvedValue({
      version: 1,
      ai_calls: 1,
      export_svg: 2,
      export_png: 1,
      export_pdf: 1,
      render_failure: 0,
      updated_at: new Date().toISOString(),
    });
    const { GET } = await import("@/app/api/admin/metrics/route");

    const response = await GET(new NextRequest("http://localhost/api/admin/metrics"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.metrics.ai_calls).toBe(1);
  });
});
