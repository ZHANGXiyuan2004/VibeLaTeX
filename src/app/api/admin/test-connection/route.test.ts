import { NextRequest } from "next/server";
import { vi } from "vitest";

const requireAdminApiAuthMock = vi.fn();
const getConfigMock = vi.fn();
const testProviderConnectionMock = vi.fn();

vi.mock("@/server/admin-auth", () => ({
  requireAdminApiAuth: requireAdminApiAuthMock,
}));

vi.mock("@/server/config-store", () => ({
  getConfig: getConfigMock,
}));

vi.mock("@/server/llm-client", () => ({
  testProviderConnection: testProviderConnectionMock,
}));

describe("POST /api/admin/test-connection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminApiAuthMock.mockReturnValue(null);
    getConfigMock.mockResolvedValue({
      provider: {
        base_url: "https://api.openai.com/v1",
        api_key: "",
        model: "gpt",
        timeout: 1000,
        retry_attempts: 1,
        retry_backoff_ms: 400,
        headers: {},
      },
    });
  });

  it("returns test result", async () => {
    testProviderConnectionMock.mockResolvedValue({ ok: true, message: "ok" });

    const { POST } = await import("@/app/api/admin/test-connection/route");

    const req = new NextRequest("http://localhost/api/admin/test-connection", {
      method: "POST",
      body: JSON.stringify({
        provider: { model: "gpt-4.1-mini" },
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(testProviderConnectionMock).toHaveBeenCalledTimes(1);
  });

  it("rejects retry attempts greater than one", async () => {
    const { POST } = await import("@/app/api/admin/test-connection/route");

    const req = new NextRequest("http://localhost/api/admin/test-connection", {
      method: "POST",
      body: JSON.stringify({
        provider: { retry_attempts: 2 },
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(testProviderConnectionMock).not.toHaveBeenCalled();
  });
});
