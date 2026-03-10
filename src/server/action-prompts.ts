import type { AppConfig, LlmActionRequest } from "@/shared/types";

export interface ActionPromptBundle {
  system: string;
  user: string;
}

const RESPONSE_CONTRACT = [
  "Return strict JSON. Required key: latex (string). Optional keys: changes (string[]), explanation (string), reasoning (string), meta (object).",
  "Do not output <think> tags, markdown code fences, tool calls, or any text outside JSON.",
].join(" ");

function isKatexCompatible(config: AppConfig, request: LlmActionRequest): boolean {
  const requested = request.constraints?.katex_compatible;
  if (typeof requested === "boolean") {
    return requested;
  }
  return config.style_rules.enforce_katex_compatible;
}

export function buildActionPrompt(config: AppConfig, request: LlmActionRequest): ActionPromptBundle {
  const katexGuard = isKatexCompatible(config, request)
    ? "Output must be KaTeX compatible."
    : "KaTeX compatibility is not required.";

  switch (request.action) {
    case "format_latex": {
      return {
        system: [
          "You are a precise LaTeX formatter.",
          "Do not change mathematical meaning.",
          katexGuard,
          RESPONSE_CONTRACT,
        ].join("\n"),
        user: `Format this LaTeX:\n\n${request.latex ?? ""}`,
      };
    }
    case "fix_latex": {
      return {
        system: [
          "You are a LaTeX repair assistant.",
          "Fix only what is needed to make the expression render.",
          "Keep semantics unchanged when possible.",
          katexGuard,
          RESPONSE_CONTRACT,
        ].join("\n"),
        user: `Failed latex:\n${request.latex ?? ""}\n\nRender error:\n${request.error_message ?? "Unknown error"}`,
      };
    }
    case "refactor_latex": {
      return {
        system: [
          "You are a LaTeX readability refactorer.",
          "Keep semantics unchanged.",
          katexGuard,
          RESPONSE_CONTRACT,
        ].join("\n"),
        user: `Refactor this latex for readability:\n\n${request.latex ?? ""}`,
      };
    }
    case "nl_to_latex": {
      return {
        system: [
          "You convert natural language descriptions into LaTeX formulas.",
          katexGuard,
          RESPONSE_CONTRACT,
        ].join("\n"),
        user: request.instruction ?? "",
      };
    }
    case "explain_latex": {
      return {
        system: [
          "You explain LaTeX formulas clearly and briefly.",
          "Set latex field exactly equal to the input formula, unchanged.",
          RESPONSE_CONTRACT,
        ].join("\n"),
        user: `Explain this formula briefly:\n\n${request.latex ?? ""}`,
      };
    }
    case "img_to_latex": {
      return {
        system: [
          "You convert formula images to LaTeX.",
          katexGuard,
          RESPONSE_CONTRACT,
        ].join("\n"),
        user: "Extract LaTeX from the given image.",
      };
    }
    default: {
      return {
        system: [
          "You are a LaTeX assistant.",
          RESPONSE_CONTRACT,
        ].join("\n"),
        user: request.latex ?? request.instruction ?? "",
      };
    }
  }
}
