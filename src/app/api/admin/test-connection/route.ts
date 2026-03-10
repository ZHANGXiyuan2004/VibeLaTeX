import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import type { AppConfig } from "@/shared/types";
import { requireAdminApiAuth } from "@/server/admin-auth";
import { getConfig } from "@/server/config-store";
import { testProviderConnection } from "@/server/llm-client";

const providerPatchSchema = z
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
  })
  .partial();

function mergeConfig(base: AppConfig, patch: { provider?: Partial<AppConfig["provider"]> }): AppConfig {
  return {
    ...base,
    provider: {
      ...base.provider,
      ...(patch.provider ?? {}),
    },
  };
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdminApiAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = providerPatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid test payload.",
        detail: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const config = await getConfig();
  const merged = mergeConfig(config, parsed.data);

  const result = await testProviderConnection(merged);
  const status = result.ok ? 200 : 502;

  return NextResponse.json(result, { status });
}
