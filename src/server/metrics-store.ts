import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type { MetricEvent, MetricsSnapshot } from "@/shared/types";
import { logError } from "@/server/error-log";

const metricsSchema = z.object({
  version: z.literal(1),
  ai_calls: z.number().int().min(0),
  export_svg: z.number().int().min(0),
  export_png: z.number().int().min(0),
  export_pdf: z.number().int().min(0),
  render_failure: z.number().int().min(0),
  updated_at: z.string(),
});

const DEFAULT_METRICS: MetricsSnapshot = {
  version: 1,
  ai_calls: 0,
  export_svg: 0,
  export_png: 0,
  export_pdf: 0,
  render_failure: 0,
  updated_at: new Date(0).toISOString(),
};

function getMetricsPath(): string {
  const override = process.env.VIBELATEX_METRICS_PATH?.trim();
  if (override) {
    return override;
  }

  return path.join(process.cwd(), ".data", "metrics.json");
}

async function ensureMetricsFile(): Promise<void> {
  const metricsPath = getMetricsPath();
  await mkdir(path.dirname(metricsPath), { recursive: true });

  try {
    await readFile(metricsPath, "utf8");
  } catch {
    await writeFile(metricsPath, JSON.stringify(DEFAULT_METRICS, null, 2), "utf8");
  }
}

async function writeSnapshot(snapshot: MetricsSnapshot): Promise<void> {
  const metricsPath = getMetricsPath();
  await mkdir(path.dirname(metricsPath), { recursive: true });
  await writeFile(metricsPath, JSON.stringify(snapshot, null, 2), "utf8");
}

export async function getMetricsSnapshot(): Promise<MetricsSnapshot> {
  const metricsPath = getMetricsPath();

  try {
    await ensureMetricsFile();
    const raw = await readFile(metricsPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return metricsSchema.parse(parsed);
  } catch (error) {
    logError("metrics-store", "Failed to load metrics, fallback to defaults.", {
      error: error instanceof Error ? error.message : String(error),
      metricsPath,
    });
    return {
      ...DEFAULT_METRICS,
      updated_at: new Date().toISOString(),
    };
  }
}

export async function incrementMetric(event: MetricEvent): Promise<MetricsSnapshot> {
  const current = await getMetricsSnapshot();
  const next: MetricsSnapshot = {
    ...current,
    updated_at: new Date().toISOString(),
  };

  if (event === "ai_call") {
    next.ai_calls += 1;
  } else if (event === "export_svg") {
    next.export_svg += 1;
  } else if (event === "export_png") {
    next.export_png += 1;
  } else if (event === "export_pdf") {
    next.export_pdf += 1;
  } else if (event === "render_failure") {
    next.render_failure += 1;
  }

  await writeSnapshot(next);
  return next;
}
