import { NextRequest } from "next/server";
import { vi } from "vitest";

const getConfigMock = vi.fn();
const callLlmActionMock = vi.fn();

vi.mock("@/server/config-store", () => ({
  getConfig: getConfigMock,
}));

vi.mock("@/server/llm-client", () => ({
  callLlmAction: callLlmActionMock,
}));

describe("POST /api/llm/action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getConfigMock.mockResolvedValue({
      capabilities: {
        vision: false,
      },
      features_enabled: {
        ai: true,
        format: true,
        fix: true,
        refactor: true,
        nl_to_latex: true,
        explain: true,
        export_pdf: true,
        image_to_latex: false,
      },
    });
  });

  it("validates fix payload", async () => {
    const { POST } = await import("@/app/api/llm/action/route");

    const response = await POST(
      new NextRequest("http://localhost/api/llm/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "fix_latex", latex: "x" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns provider response", async () => {
    callLlmActionMock.mockResolvedValue({
      ok: true,
      latex: "x+y",
    });

    const { POST } = await import("@/app/api/llm/action/route");

    const response = await POST(
      new NextRequest("http://localhost/api/llm/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "format_latex", latex: "x+y" }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(callLlmActionMock).toHaveBeenCalledTimes(1);
  });

  it("validates nl_to_latex payload", async () => {
    const { POST } = await import("@/app/api/llm/action/route");

    const response = await POST(
      new NextRequest("http://localhost/api/llm/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "nl_to_latex" }),
      }),
    );

    expect(response.status).toBe(400);
  });
});
