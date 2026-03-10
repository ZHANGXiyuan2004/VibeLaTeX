import { NextResponse } from "next/server";
import { z } from "zod";

import { getConfig } from "@/server/config-store";
import { classifyPdfExportError, exportLatexToPdfBuffer } from "@/server/pdf-export";

export const runtime = "nodejs";

const requestSchema = z.object({
  latex: z.string().min(1, "latex is required"),
  mode: z.enum(["inline", "block"]).default("block"),
  style: z.object({
    font_size: z.number().int().min(10).max(96),
    text_color: z.string().min(1),
    background_mode: z.enum(["transparent", "solid"]),
    background_color: z.string().min(1),
    padding: z.number().int().min(0).max(64),
    align: z.enum(["left", "center", "right"]),
  }),
  pdf: z.object({
    page_size: z.enum(["A4", "Letter"]),
    margin_pt: z.union([z.literal(12), z.literal(24), z.literal(36)]),
    background_mode: z.enum(["transparent", "solid"]),
  }),
});

function mapErrorStatus(code: string): number {
  if (code === "timeout") {
    return 504;
  }
  if (code === "font_missing") {
    return 422;
  }
  return 422;
}

export async function POST(request: Request) {
  const config = await getConfig();
  if (!config.features_enabled.export_pdf) {
    return NextResponse.json(
      {
        ok: false,
        error: "PDF export is disabled in settings.",
      },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid PDF export payload.",
        detail: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const buffer = await exportLatexToPdfBuffer(parsed.data);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="vibelatex-${Date.now()}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const normalized = classifyPdfExportError(error);
    return NextResponse.json(
      {
        ok: false,
        code: normalized.code,
        error: normalized.message,
      },
      { status: mapErrorStatus(normalized.code) },
    );
  }
}
