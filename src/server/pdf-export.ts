import { existsSync } from "node:fs";
import katex from "katex";
import { chromium } from "@playwright/test";

import type { AlignMode, BackgroundMode, LatexMode, PdfExportOptions } from "@/shared/types";

export type PdfExportErrorCode = "render_failed" | "timeout" | "font_missing";

export class PdfExportError extends Error {
  code: PdfExportErrorCode;

  constructor(code: PdfExportErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface PdfExportRequest {
  latex: string;
  mode: LatexMode;
  style: {
    font_size: number;
    text_color: string;
    background_mode: BackgroundMode;
    background_color: string;
    padding: number;
    align: AlignMode;
  };
  pdf: PdfExportOptions;
  timeout_ms?: number;
}

const CHROME_EXECUTABLE_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeColor(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : fallback;
}

function resolveAlign(align: AlignMode): { justify: string; text: string } {
  if (align === "left") {
    return { justify: "flex-start", text: "left" };
  }
  if (align === "right") {
    return { justify: "flex-end", text: "right" };
  }
  return { justify: "center", text: "center" };
}

function buildPdfHtml(input: {
  renderedLatex: string;
  style: PdfExportRequest["style"];
  pdf: PdfExportOptions;
}): string {
  const fontSize = clampInt(input.style.font_size, 10, 96);
  const padding = clampInt(input.style.padding, 0, 64);
  const textColor = normalizeColor(input.style.text_color, "#0f172a");
  const bgColor = normalizeColor(input.style.background_color, "#ffffff");
  const marginPt = clampInt(input.pdf.margin_pt, 12, 36);
  const align = resolveAlign(input.style.align);
  const showSolidBg = input.pdf.background_mode === "solid" || input.style.background_mode === "solid";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.32/dist/katex.min.css" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
      }
      body {
        min-height: 100vh;
        background: #ffffff;
      }
      .vibelatex-pdf-page {
        min-height: 100vh;
        display: flex;
        box-sizing: border-box;
        padding: ${marginPt}pt;
      }
      .vibelatex-pdf-shell {
        width: 100%;
        min-height: calc(100vh - ${marginPt * 2}pt);
        display: flex;
        justify-content: ${align.justify};
        align-items: flex-start;
        text-align: ${align.text};
      }
      .vibelatex-pdf-formula {
        display: inline-block;
        max-width: 100%;
        color: ${textColor};
        font-size: ${fontSize}px;
        padding: ${padding}px;
        box-sizing: border-box;
        background: ${showSolidBg ? bgColor : "transparent"};
      }
      .katex-display {
        margin: 0;
      }
    </style>
  </head>
  <body>
    <main class="vibelatex-pdf-page">
      <section class="vibelatex-pdf-shell">
        <div class="vibelatex-pdf-formula">${input.renderedLatex}</div>
      </section>
    </main>
  </body>
</html>`;
}

export function classifyPdfExportError(error: unknown): PdfExportError {
  if (error instanceof PdfExportError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();

  if (lowered.includes("timeout")) {
    return new PdfExportError("timeout", "PDF rendering timed out.");
  }

  if (lowered.includes("font")) {
    return new PdfExportError("font_missing", "PDF rendering failed because required fonts are unavailable.");
  }

  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    return new PdfExportError("render_failed", "PDF rendering failed.");
  }

  return new PdfExportError("render_failed", `PDF rendering failed: ${normalizedMessage}`);
}

async function launchPdfBrowser() {
  const launchAttempts: Array<() => Promise<Awaited<ReturnType<typeof chromium.launch>>>> = [
    () => chromium.launch({ headless: true }),
    () => chromium.launch({ headless: true, channel: "chrome" }),
    () => chromium.launch({ headless: true, channel: "msedge" }),
  ];

  const explicitPath = process.env.VIBELATEX_PDF_CHROME_PATH?.trim();
  const pathCandidates = [
    explicitPath,
    ...CHROME_EXECUTABLE_CANDIDATES,
  ].filter((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

  for (const executablePath of pathCandidates) {
    launchAttempts.push(() =>
      chromium.launch({
        headless: true,
        executablePath,
      }),
    );
  }

  let lastError: unknown = null;
  for (const attempt of launchAttempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError ?? "");
  const hasMissingExecutableHint =
    message.toLowerCase().includes("executable") || message.toLowerCase().includes("browser");
  const guidance = hasMissingExecutableHint
    ? " Install Chromium with `npx playwright install chromium` or set VIBELATEX_PDF_CHROME_PATH to your Chrome executable."
    : "";

  throw new PdfExportError(
    "render_failed",
    `PDF rendering failed: browser runtime unavailable.${guidance}`.trim(),
  );
}

export async function exportLatexToPdfBuffer(input: PdfExportRequest): Promise<Buffer> {
  const timeoutMs = clampInt(input.timeout_ms ?? 25_000, 5_000, 60_000);
  const renderedLatex = (() => {
    try {
      return katex.renderToString(input.latex, {
        displayMode: input.mode === "block",
        throwOnError: true,
        output: "htmlAndMathml",
        strict: "warn",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Formula render failed.";
      throw new PdfExportError("render_failed", `PDF rendering failed: ${message}`);
    }
  })();

  const browser = await launchPdfBrowser();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);

    await page.setContent(
      buildPdfHtml({
        renderedLatex,
        style: input.style,
        pdf: input.pdf,
      }),
      { waitUntil: "domcontentloaded" },
    );

    await page.waitForSelector(".vibelatex-pdf-formula .katex", { timeout: timeoutMs });
    await page.evaluate(async () => {
      if ("fonts" in document) {
        await (document as Document & { fonts: FontFaceSet }).fonts.ready;
      }
    });

    const pdfBuffer = await page.pdf({
      format: input.pdf.page_size,
      printBackground: true,
      margin: {
        top: `${input.pdf.margin_pt}px`,
        right: `${input.pdf.margin_pt}px`,
        bottom: `${input.pdf.margin_pt}px`,
        left: `${input.pdf.margin_pt}px`,
      },
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new PdfExportError("render_failed", "PDF renderer returned an empty file.");
    }

    return Buffer.from(pdfBuffer);
  } catch (error) {
    throw classifyPdfExportError(error);
  } finally {
    await browser.close();
  }
}
