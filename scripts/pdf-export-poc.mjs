import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const BASE_URL = process.env.PDF_POC_BASE_URL || "http://127.0.0.1:3006";
const OUT_PATH = process.env.PDF_POC_OUT || path.join(process.cwd(), ".data", "poc", "formula-preview.pdf");
const FORMULA = process.env.PDF_POC_FORMULA || String.raw`\\int_0^1 x^2 \\, dx`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    const editor = page.locator(".monaco-editor").first();
    await editor.click({ position: { x: 160, y: 42 } });
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.type(FORMULA);

    await page.waitForSelector(".vibelatex-formula-content .katex, .vibelatex-formula-content mjx-container", {
      timeout: 10_000,
    });

    await mkdir(path.dirname(OUT_PATH), { recursive: true });
    await page.pdf({
      path: OUT_PATH,
      printBackground: true,
      width: "11in",
      height: "8.5in",
      margin: {
        top: "0.3in",
        right: "0.3in",
        bottom: "0.3in",
        left: "0.3in",
      },
    });

    console.log(`PDF PoC exported: ${OUT_PATH}`);
  } finally {
    await browser.close();
  }
})();
