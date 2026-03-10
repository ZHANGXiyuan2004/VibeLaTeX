import { vi } from "vitest";

const getConfigMock = vi.fn();
const toPublicConfigMock = vi.fn();

vi.mock("@/server/config-store", () => ({
  getConfig: getConfigMock,
  toPublicConfig: toPublicConfigMock,
}));

describe("GET /api/config", () => {
  it("returns public config", async () => {
    getConfigMock.mockResolvedValue({ foo: "bar" });
    toPublicConfigMock.mockReturnValue({ capabilities: { vision: false } });

    const { GET } = await import("@/app/api/config/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.capabilities.vision).toBe(false);
  });
});
