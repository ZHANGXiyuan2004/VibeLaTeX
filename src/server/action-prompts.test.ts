import { buildActionPrompt } from "@/server/action-prompts";
import { DEFAULT_APP_CONFIG } from "@/server/config-store";

describe("action-prompts", () => {
  it("builds formatter prompt", () => {
    const prompt = buildActionPrompt(DEFAULT_APP_CONFIG, {
      action: "format_latex",
      latex: "x^2 + y^2",
    });

    expect(prompt.system).toContain("formatter");
    expect(prompt.user).toContain("x^2 + y^2");
  });

  it("builds fix prompt with error", () => {
    const prompt = buildActionPrompt(DEFAULT_APP_CONFIG, {
      action: "fix_latex",
      latex: "\\frac{1}{",
      error_message: "parse error",
    });

    expect(prompt.system).toContain("repair assistant");
    expect(prompt.user).toContain("parse error");
  });

  it("builds nl_to_latex prompt", () => {
    const prompt = buildActionPrompt(DEFAULT_APP_CONFIG, {
      action: "nl_to_latex",
      instruction: "sum of first n integers",
    });

    expect(prompt.system).toContain("natural language");
    expect(prompt.user).toContain("first n integers");
  });

  it("builds explain prompt with unchanged latex contract", () => {
    const prompt = buildActionPrompt(DEFAULT_APP_CONFIG, {
      action: "explain_latex",
      latex: "x^2+y^2",
    });

    expect(prompt.system).toContain("exactly equal");
    expect(prompt.user).toContain("x^2+y^2");
  });
});
