import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_SAMPLE_PATH = path.join(process.cwd(), "scripts", "fixtures", "ai-fix-samples.json");
const DEFAULT_REPORT_PATH = path.join(process.cwd(), "docs", "reports", "ai-fix-benchmark-latest.md");
const DEFAULT_BASE_URL = "http://127.0.0.1:3006";
const DEFAULT_THRESHOLD = 0.8;

function readArg(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) {
    return fallback;
  }

  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    return fallback;
  }

  return value;
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl).trim().replace(/\/+$/, "");
}

function normalizeLatex(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function toSafeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function evaluateCase(sample, responsePayload) {
  const reasons = [];
  const inputLatex = normalizeLatex(sample.latex);
  const fixedLatex = normalizeLatex(responsePayload?.latex);

  if (!responsePayload?.ok) {
    reasons.push(responsePayload?.error ? `provider_error:${responsePayload.error}` : "provider_error");
  }

  if (!fixedLatex) {
    reasons.push("empty_latex");
  }

  const mustChange = sample.must_change !== false;
  if (mustChange && fixedLatex && fixedLatex === inputLatex) {
    reasons.push("latex_not_changed");
  }

  for (const fragment of sample.expected_contains ?? []) {
    if (!fixedLatex.includes(fragment)) {
      reasons.push(`missing:${fragment}`);
    }
  }

  for (const fragment of sample.forbidden_contains ?? []) {
    if (fixedLatex.includes(fragment)) {
      reasons.push(`forbidden:${fragment}`);
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
    fixedLatex,
  };
}

async function runLiveCase(baseUrl, sample) {
  const endpoint = `${normalizeBaseUrl(baseUrl)}/api/llm/action`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "fix_latex",
      latex: sample.latex,
      error_message: sample.error_message,
      constraints: {
        katex_compatible: true,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));

  return {
    status: response.status,
    payload: {
      ok: Boolean(payload?.ok),
      latex: typeof payload?.latex === "string" ? payload.latex : "",
      error: typeof payload?.error === "string" ? payload.error : "",
      raw: payload,
    },
  };
}

function runMockCase(sample) {
  return {
    status: 200,
    payload: {
      ok: true,
      latex: sample.mock_fixed_latex ?? sample.latex,
      error: "",
      raw: {
        mock: true,
      },
    },
  };
}

function formatRate(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function buildReport({
  mode,
  baseUrl,
  threshold,
  samplePath,
  results,
  successCount,
  successRate,
}) {
  const generatedAt = new Date().toISOString();
  const failed = results.filter((item) => !item.passed);

  const lines = [];
  lines.push("# AI Fix Benchmark Report");
  lines.push("");
  lines.push(`- Generated at: ${generatedAt}`);
  lines.push(`- Mode: ${mode}`);
  lines.push(`- Base URL: ${baseUrl}`);
  lines.push(`- Sample file: ${samplePath}`);
  lines.push(`- Samples: ${results.length}`);
  lines.push(`- Passed: ${successCount}`);
  lines.push(`- Success rate: ${formatRate(successRate)}`);
  lines.push(`- Threshold: ${formatRate(threshold)}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| ID | Result | Elapsed (ms) | Notes |");
  lines.push("|---|---|---:|---|");

  for (const item of results) {
    lines.push(
      `| ${item.id} | ${item.passed ? "PASS" : "FAIL"} | ${item.elapsedMs} | ${item.reasons.length > 0 ? item.reasons.join(", ") : "-"} |`,
    );
  }

  if (failed.length > 0) {
    lines.push("");
    lines.push("## Failed Cases");

    for (const item of failed) {
      lines.push("");
      lines.push(`### ${item.id} - ${item.title}`);
      lines.push(`- HTTP status: ${item.status}`);
      lines.push(`- Reasons: ${item.reasons.join(", ")}`);
      lines.push("- Input latex:");
      lines.push("```tex");
      lines.push(String(item.inputLatex));
      lines.push("```");
      lines.push("- Render error:");
      lines.push("```text");
      lines.push(String(item.errorMessage));
      lines.push("```");
      lines.push("- Provider output latex:");
      lines.push("```tex");
      lines.push(String(item.outputLatex));
      lines.push("```");
      if (item.providerError) {
        lines.push("- Provider error:");
        lines.push("```text");
        lines.push(String(item.providerError));
        lines.push("```");
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const mode = (process.env.AI_FIX_BENCHMARK_MODE ?? "live").toLowerCase() === "mock" ? "mock" : "live";
  const baseUrl = process.env.AI_FIX_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const threshold = toSafeNumber(process.env.AI_FIX_THRESHOLD, DEFAULT_THRESHOLD);
  const samplePath = readArg("--samples", DEFAULT_SAMPLE_PATH);
  const reportPath = readArg("--output", DEFAULT_REPORT_PATH);

  const raw = await readFile(samplePath, "utf8");
  const samples = JSON.parse(raw);

  if (!Array.isArray(samples)) {
    throw new Error("Sample file must be a JSON array.");
  }

  const results = [];

  for (const sample of samples) {
    const startAt = Date.now();

    const current = {
      id: String(sample?.id ?? "unknown"),
      title: String(sample?.title ?? "Untitled"),
      inputLatex: String(sample?.latex ?? ""),
      errorMessage: String(sample?.error_message ?? ""),
      status: 0,
      outputLatex: "",
      providerError: "",
      passed: false,
      reasons: [],
      elapsedMs: 0,
    };

    try {
      const runResult = mode === "mock" ? runMockCase(sample) : await runLiveCase(baseUrl, sample);
      const evaluated = evaluateCase(sample, runResult.payload);

      current.status = runResult.status;
      current.outputLatex = evaluated.fixedLatex;
      current.providerError = runResult.payload?.error ?? "";
      current.passed = evaluated.passed;
      current.reasons = evaluated.reasons;
    } catch (error) {
      current.status = 0;
      current.passed = false;
      current.reasons = [error instanceof Error ? error.message : "benchmark_case_failed"];
    }

    current.elapsedMs = Date.now() - startAt;
    results.push(current);
  }

  const successCount = results.filter((item) => item.passed).length;
  const successRate = results.length > 0 ? successCount / results.length : 0;

  const report = buildReport({
    mode,
    baseUrl,
    threshold,
    samplePath,
    results,
    successCount,
    successRate,
  });

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, report, "utf8");

  console.log(`AI Fix benchmark finished: ${successCount}/${results.length} (${formatRate(successRate)})`);
  console.log(`Report written to: ${reportPath}`);

  if (results.length < 10) {
    console.error(`FAIL: sample count ${results.length} is below required minimum 10.`);
    process.exitCode = 1;
    return;
  }

  if (successRate < threshold) {
    console.error(`FAIL: success rate ${formatRate(successRate)} below threshold ${formatRate(threshold)}.`);
    process.exitCode = 1;
    return;
  }

  console.log(`PASS: success rate ${formatRate(successRate)} meets threshold ${formatRate(threshold)}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
