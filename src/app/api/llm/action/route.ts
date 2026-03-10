import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import type { LlmActionRequest } from "@/shared/types";
import { getConfig } from "@/server/config-store";
import { callLlmAction } from "@/server/llm-client";
import {
  consumeAiRateLimit,
  getClientIp,
  getOrCreateAiSession,
} from "@/server/ai-rate-limit";

const requestSchema = z.object({
  action: z.enum([
    "format_latex",
    "fix_latex",
    "refactor_latex",
    "nl_to_latex",
    "explain_latex",
    "img_to_latex",
  ]),
  latex: z.string().optional(),
  error_message: z.string().optional(),
  instruction: z.string().optional(),
  constraints: z.record(z.string(), z.unknown()).optional(),
  image: z.string().optional(),
});

function validateActionInput(input: LlmActionRequest): string | null {
  if (
    (input.action === "format_latex" ||
      input.action === "fix_latex" ||
      input.action === "refactor_latex" ||
      input.action === "explain_latex") &&
    !input.latex
  ) {
    return "latex is required for format/fix/refactor/explain actions.";
  }

  if (input.action === "fix_latex" && !input.error_message) {
    return "error_message is required for fix_latex.";
  }

  if (input.action === "nl_to_latex" && !input.instruction) {
    return "instruction is required for nl_to_latex.";
  }

  if (input.action === "img_to_latex" && !input.image) {
    return "image is required for img_to_latex.";
  }

  return null;
}

function buildCommonHeaders(input: {
  setCookieHeader?: string;
  remaining: number;
  resetAt: number;
}): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Remaining", String(input.remaining));
  headers.set("X-RateLimit-Reset", String(input.resetAt));
  if (input.setCookieHeader) {
    headers.set("Set-Cookie", input.setCookieHeader);
  }
  return headers;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        latex: "",
        error: "Invalid request payload.",
        detail: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const config = await getConfig();
  const { sessionId, setCookieHeader } = getOrCreateAiSession(request);
  const rateLimit = consumeAiRateLimit({
    ip: getClientIp(request),
    sessionId,
  });
  const headers = buildCommonHeaders({
    setCookieHeader,
    remaining: rateLimit.remaining,
    resetAt: rateLimit.reset_at,
  });

  if (!rateLimit.ok) {
    headers.set("Retry-After", String(Math.max(1, Math.ceil((rateLimit.reset_at - Date.now()) / 1000))));
    return NextResponse.json(
      {
        ok: false,
        latex: parsed.data.latex ?? "",
        error: "Too many AI requests. Please retry shortly.",
      },
      { status: 429, headers },
    );
  }

  if (!config.features_enabled.ai) {
    return NextResponse.json(
      {
        ok: false,
        latex: parsed.data.latex ?? "",
        error: "AI feature is disabled.",
      },
      { status: 403, headers },
    );
  }

  if (parsed.data.action === "format_latex" && !config.features_enabled.format) {
    return NextResponse.json(
      {
        ok: false,
        latex: parsed.data.latex ?? "",
        error: "Format action is disabled.",
      },
      { status: 403, headers },
    );
  }

  if (parsed.data.action === "fix_latex" && !config.features_enabled.fix) {
    return NextResponse.json(
      {
        ok: false,
        latex: parsed.data.latex ?? "",
        error: "Fix action is disabled.",
      },
      { status: 403, headers },
    );
  }

  if (parsed.data.action === "refactor_latex" && !config.features_enabled.refactor) {
    return NextResponse.json(
      {
        ok: false,
        latex: parsed.data.latex ?? "",
        error: "Refactor action is disabled.",
      },
      { status: 403, headers },
    );
  }

  if (parsed.data.action === "nl_to_latex" && !config.features_enabled.nl_to_latex) {
    return NextResponse.json(
      {
        ok: false,
        latex: parsed.data.latex ?? "",
        error: "NL to LaTeX action is disabled.",
      },
      { status: 403, headers },
    );
  }

  if (parsed.data.action === "explain_latex" && !config.features_enabled.explain) {
    return NextResponse.json(
      {
        ok: false,
        latex: parsed.data.latex ?? "",
        error: "Explain action is disabled.",
      },
      { status: 403, headers },
    );
  }

  if (parsed.data.action === "img_to_latex" && !config.features_enabled.image_to_latex) {
    return NextResponse.json(
      {
        ok: false,
        latex: parsed.data.latex ?? "",
        error: "Image to LaTeX action is disabled.",
      },
      { status: 403, headers },
    );
  }

  if (parsed.data.action === "img_to_latex" && !config.capabilities.vision) {
    return NextResponse.json(
      {
        ok: false,
        latex: parsed.data.latex ?? "",
        error: "Current model does not support image recognition.",
      },
      { status: 403, headers },
    );
  }

  const inputError = validateActionInput(parsed.data);
  if (inputError) {
    return NextResponse.json(
      {
        ok: false,
        latex: parsed.data.latex ?? "",
        error: inputError,
      },
      { status: 400, headers },
    );
  }

  const result = await callLlmAction(config, parsed.data);
  const status = result.ok ? 200 : 502;
  return NextResponse.json(result, { status, headers });
}
