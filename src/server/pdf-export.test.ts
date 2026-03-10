import { classifyPdfExportError, PdfExportError } from "@/server/pdf-export";

describe("pdf-export", () => {
  it("keeps explicit PdfExportError as-is", () => {
    const error = new PdfExportError("timeout", "PDF rendering timed out.");
    const normalized = classifyPdfExportError(error);
    expect(normalized.code).toBe("timeout");
    expect(normalized.message).toContain("timed out");
  });

  it("classifies font-related errors", () => {
    const normalized = classifyPdfExportError(new Error("font load failed"));
    expect(normalized.code).toBe("font_missing");
  });

  it("classifies unknown errors as render failure", () => {
    const normalized = classifyPdfExportError(new Error("unexpected"));
    expect(normalized.code).toBe("render_failed");
  });
});
