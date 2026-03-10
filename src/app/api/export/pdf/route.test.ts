import { vi } from "vitest";

const getConfigMock = vi.fn();
const exportLatexToPdfBufferMock = vi.fn();
const classifyPdfExportErrorMock = vi.fn();

vi.mock("@/server/config-store", () => ({
  getConfig: getConfigMock,
}));

vi.mock("@/server/pdf-export", () => ({
  exportLatexToPdfBuffer: exportLatexToPdfBufferMock,
  classifyPdfExportError: classifyPdfExportErrorMock,
}));

describe("POST /api/export/pdf", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getConfigMock.mockResolvedValue({
      features_enabled: {
        export_pdf: true,
      },
    });
    classifyPdfExportErrorMock.mockReturnValue({
      code: "render_failed",
      message: "PDF rendering failed.",
    });
  });

  it("returns pdf binary on success", async () => {
    exportLatexToPdfBufferMock.mockResolvedValue(Buffer.from("%PDF-1.4"));
    const { POST } = await import("@/app/api/export/pdf/route");

    const response = await POST(
      new Request("http://localhost/api/export/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          latex: "x^2+y^2",
          mode: "block",
          style: {
            font_size: 18,
            text_color: "#0f172a",
            background_mode: "transparent",
            background_color: "#ffffff",
            padding: 16,
            align: "center",
          },
          pdf: {
            page_size: "A4",
            margin_pt: 24,
            background_mode: "transparent",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/pdf");
    expect(exportLatexToPdfBufferMock).toHaveBeenCalledTimes(1);
  });

  it("rejects when pdf feature is disabled", async () => {
    getConfigMock.mockResolvedValue({
      features_enabled: {
        export_pdf: false,
      },
    });
    const { POST } = await import("@/app/api/export/pdf/route");

    const response = await POST(
      new Request("http://localhost/api/export/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          latex: "x",
          mode: "inline",
          style: {
            font_size: 14,
            text_color: "#0f172a",
            background_mode: "transparent",
            background_color: "#ffffff",
            padding: 8,
            align: "left",
          },
          pdf: {
            page_size: "A4",
            margin_pt: 12,
            background_mode: "transparent",
          },
        }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it("maps timeout export errors", async () => {
    exportLatexToPdfBufferMock.mockRejectedValue(new Error("timeout"));
    classifyPdfExportErrorMock.mockReturnValue({
      code: "timeout",
      message: "PDF rendering timed out.",
    });
    const { POST } = await import("@/app/api/export/pdf/route");

    const response = await POST(
      new Request("http://localhost/api/export/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          latex: "x",
          mode: "inline",
          style: {
            font_size: 14,
            text_color: "#0f172a",
            background_mode: "transparent",
            background_color: "#ffffff",
            padding: 8,
            align: "left",
          },
          pdf: {
            page_size: "Letter",
            margin_pt: 36,
            background_mode: "solid",
          },
        }),
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(504);
    expect(body.code).toBe("timeout");
  });
});
