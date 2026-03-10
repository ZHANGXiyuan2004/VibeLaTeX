import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireAdminApiAuth } from "@/server/admin-auth";
import { saveConfig, type DeepPartial } from "@/server/config-store";
import type { AppConfig } from "@/shared/types";

const configPatchSchema = z
  .object({
    provider: z
      .object({
        base_url: z.string().min(1).optional(),
        api_key: z.string().optional(),
        model: z.string().min(1).optional(),
        timeout: z.number().int().positive().optional(),
        retry_attempts: z.number().int().min(0).max(1).optional(),
        retry_backoff_ms: z.number().int().positive().max(30_000).optional(),
        headers: z.record(z.string(), z.string()).optional(),
      })
      .partial()
      .optional(),
    capabilities: z
      .object({
        vision: z.boolean().optional(),
        mathjax: z.boolean().optional(),
      })
      .partial()
      .optional(),
    features_enabled: z
      .object({
        ai: z.boolean().optional(),
        format: z.boolean().optional(),
        fix: z.boolean().optional(),
        refactor: z.boolean().optional(),
        nl_to_latex: z.boolean().optional(),
        explain: z.boolean().optional(),
        export_svg: z.boolean().optional(),
        export_png: z.boolean().optional(),
        export_pdf: z.boolean().optional(),
        image_to_latex: z.boolean().optional(),
      })
      .partial()
      .optional(),
    default_export_options: z
      .object({
        format: z.enum(["svg", "png"]).optional(),
        scale: z.union([z.literal(1), z.literal(2), z.literal(4)]).optional(),
        padding: z.number().int().min(0).max(64).optional(),
        background_mode: z.enum(["transparent", "solid"]).optional(),
        background_color: z.string().optional(),
        trim: z.enum(["tight", "include_padding"]).optional(),
      })
      .partial()
      .optional(),
    style_rules: z
      .object({
        enforce_katex_compatible: z.boolean().optional(),
        style_profile: z.string().optional(),
        preferred_render_engine: z.enum(["katex", "mathjax"]).optional(),
      })
      .partial()
      .optional(),
  })
  .partial();

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminApiAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = configPatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid config payload.",
        detail: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const saved = await saveConfig(parsed.data as DeepPartial<AppConfig>);

  return NextResponse.json({
    ok: true,
    config: saved,
  });
}
