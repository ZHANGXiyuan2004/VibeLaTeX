import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { getMetricsSnapshot, incrementMetric } from "@/server/metrics-store";

describe("metrics-store", () => {
  let metricsPath = "";

  beforeEach(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "vibelatex-metrics-test-"));
    metricsPath = path.join(dir, "metrics.json");
    process.env.VIBELATEX_METRICS_PATH = metricsPath;
  });

  afterEach(() => {
    delete process.env.VIBELATEX_METRICS_PATH;
  });

  it("increments counters and persists", async () => {
    const initial = await getMetricsSnapshot();
    expect(initial.ai_calls).toBe(0);

    await incrementMetric("ai_call");
    await incrementMetric("export_svg");
    await incrementMetric("export_pdf");

    const updated = await getMetricsSnapshot();
    expect(updated.ai_calls).toBe(1);
    expect(updated.export_svg).toBe(1);
    expect(updated.export_pdf).toBe(1);
  });
});
