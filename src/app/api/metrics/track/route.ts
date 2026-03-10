import { NextResponse } from "next/server";
import { z } from "zod";

import { incrementMetric } from "@/server/metrics-store";

const requestSchema = z.object({
  event: z.enum(["ai_call", "export_svg", "export_png", "export_pdf", "render_failure"]),
});

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid metrics event payload.",
      },
      { status: 400 },
    );
  }

  const snapshot = await incrementMetric(parsed.data.event);

  return NextResponse.json({
    ok: true,
    metrics: snapshot,
  });
}
