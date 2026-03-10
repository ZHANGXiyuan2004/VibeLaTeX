import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import type { LlmActionRequest, LlmActionResponse } from "@/shared/types";
import { getConfig } from "@/server/config-store";
import { callLlmActionStream } from "@/server/llm-client";
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

function validateFeatureFlags(
  input: LlmActionRequest,
  features: {
    ai: boolean;
    format: boolean;
    fix: boolean;
    refactor: boolean;
    nl_to_latex: boolean;
    explain: boolean;
    image_to_latex: boolean;
  },
): string | null {
  if (!features.ai) {
    return "AI feature is disabled.";
  }
  if (input.action === "format_latex" && !features.format) {
    return "Format action is disabled.";
  }
  if (input.action === "fix_latex" && !features.fix) {
    return "Fix action is disabled.";
  }
  if (input.action === "refactor_latex" && !features.refactor) {
    return "Refactor action is disabled.";
  }
  if (input.action === "nl_to_latex" && !features.nl_to_latex) {
    return "NL to LaTeX action is disabled.";
  }
  if (input.action === "explain_latex" && !features.explain) {
    return "Explain action is disabled.";
  }
  if (input.action === "img_to_latex" && !features.image_to_latex) {
    return "Image to LaTeX action is disabled.";
  }

  return null;
}

function streamJsonLine(
  controller: ReadableStreamDefaultController<Uint8Array>,
  payload: unknown,
): boolean {
  try {
    const encoder = new TextEncoder();
    controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
    return true;
  } catch {
    return false;
  }
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

  const actionInputError = validateActionInput(parsed.data);
  if (actionInputError) {
    return NextResponse.json(
      {
        ok: false,
        latex: parsed.data.latex ?? "",
        error: actionInputError,
      },
      { status: 400, headers },
    );
  }

  const featureFlagError = validateFeatureFlags(parsed.data, config.features_enabled);
  if (featureFlagError) {
    return NextResponse.json(
      {
        ok: false,
        latex: parsed.data.latex ?? "",
        error: featureFlagError,
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

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const closeSafely = () => {
        if (closed) {
          return;
        }
        closed = true;
        try {
          controller.close();
        } catch {
          // Stream may already be closed by runtime/client disconnect.
        }
      };

      const writeSafely = (payload: unknown) => {
        if (closed) {
          return;
        }
        const ok = streamJsonLine(controller, payload);
        if (!ok) {
          closeSafely();
        }
      };

      const run = async () => {
        try {
          const result = await callLlmActionStream(config, parsed.data, (delta) => {
            writeSafely({
              type: "delta",
              text: delta,
            });
          });

          writeSafely({
            type: "done",
            result,
          } satisfies { type: "done"; result: LlmActionResponse });
        } catch (error) {
          writeSafely({
            type: "error",
            error: error instanceof Error ? error.message : "Stream failed.",
          });
        } finally {
          closeSafely();
        }
      };

      void run();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-RateLimit-Remaining": headers.get("X-RateLimit-Remaining") ?? "0",
      "X-RateLimit-Reset": headers.get("X-RateLimit-Reset") ?? "",
      ...(headers.get("Set-Cookie")
        ? { "Set-Cookie": headers.get("Set-Cookie") as string }
        : {}),
    },
  });
}
