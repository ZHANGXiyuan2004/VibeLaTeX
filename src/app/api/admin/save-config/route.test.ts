import { NextRequest } from "next/server";
import { vi } from "vitest";

const requireAdminApiAuthMock = vi.fn();
const saveConfigMock = vi.fn();

vi.mock("@/server/admin-auth", () => ({
  requireAdminApiAuth: requireAdminApiAuthMock,
}));

vi.mock("@/server/config-store", () => ({
  saveConfig: saveConfigMock,
}));

describe("POST /api/admin/save-config", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminApiAuthMock.mockReturnValue(null);
  });

  it("saves config patch", async () => {
    saveConfigMock.mockResolvedValue({ provider: { model: "x" } });

    const { POST } = await import("@/app/api/admin/save-config/route");

    const req = new NextRequest("http://localhost/api/admin/save-config", {
      method: "POST",
      body: JSON.stringify({
        provider: {
          model: "test-model",
        },
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(req);
    expect(response.status).toBe(200);
    expect(saveConfigMock).toHaveBeenCalledTimes(1);
  });

  it("rejects retry attempts greater than one", async () => {
    const { POST } = await import("@/app/api/admin/save-config/route");

    const req = new NextRequest("http://localhost/api/admin/save-config", {
      method: "POST",
      body: JSON.stringify({
        provider: {
          retry_attempts: 2,
        },
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(saveConfigMock).not.toHaveBeenCalled();
  });
});
