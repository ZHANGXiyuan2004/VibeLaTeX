import { sanitizeLatexForApply } from "@/components/ai-panel";

describe("sanitizeLatexForApply", () => {
  it("extracts latex from json payload", () => {
    const input = JSON.stringify({
      latex: String.raw`\frac{1}{2}`,
      changes: ["normalized"],
      explanation: "formatted",
    });

    expect(sanitizeLatexForApply(input)).toBe(String.raw`\frac{1}{2}`);
  });

  it("extracts latex code fence", () => {
    const input = "```latex\n\\int_0^1 x^2\\,dx\n```";
    expect(sanitizeLatexForApply(input)).toBe(String.raw`\int_0^1 x^2\,dx`);
  });

  it("rejects non-latex json blocks", () => {
    const input = JSON.stringify({
      changes: ["added brackets"],
      explanation: "No latex field included",
    });

    expect(sanitizeLatexForApply(input)).toBe("");
  });
});
