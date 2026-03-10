import { NextRequest } from "next/server";
import { vi } from "vitest";

const getConfigMock = vi.fn();
const callLlmActionStreamMock = vi.fn();

vi.mock("@/server/config-store", () => ({
  getConfig: getConfigMock,
}));

vi.mock("@/server/llm-client", () => ({
  callLlmActionStream: callLlmActionStreamMock,
}));

describe("POST /api/llm/action/stream", () => {
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

  it("validates nl_to_latex payload", async () => {
    const { POST } = await import("@/app/api/llm/action/stream/route");

    const response = await POST(
      new NextRequest("http://localhost/api/llm/action/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "nl_to_latex" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("streams delta and done events", async () => {
    callLlmActionStreamMock.mockImplementation(
      async (
        _config: unknown,
        _request: unknown,
        onDelta: (text: string) => void,
      ) => {
        onDelta("{\"latex\":\"x");
        onDelta("+y\"}");
        return {
          ok: true,
          latex: "x+y",
        };
      },
    );

    const { POST } = await import("@/app/api/llm/action/stream/route");

    const response = await POST(
      new NextRequest("http://localhost/api/llm/action/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "format_latex", latex: "x+y" }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("\"type\":\"delta\"");
    expect(body).toContain("\"type\":\"done\"");
    expect(body).toContain("\"latex\":\"x+y\"");
  });
});
