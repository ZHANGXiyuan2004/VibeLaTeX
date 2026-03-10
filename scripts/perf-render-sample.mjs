import { spawn } from "node:child_process";

import { chromium } from "@playwright/test";

const BASE_URL = process.env.PERF_BASE_URL || "http://127.0.0.1:3006";
const MAX_SERVER_BOOT_MS = 120_000;
const FORMULAS = [
  "x^2 + y^2",
  String.raw`\\frac{a+b}{c+d}`,
  String.raw`\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}`,
  String.raw`\\int_0^1 x^2 \\, dx`,
  String.raw`\\begin{aligned}a^2-b^2&=(a-b)(a+b)\\\\x^2+y^2&=r^2\\end{aligned}`,
];

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pingServer(baseUrl) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1_500);
    const response = await fetch(baseUrl, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

async function waitForServer(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await pingServer(baseUrl)) {
      return true;
    }
    await sleep(500);
  }

  return false;
}

function resolveDevPort(baseUrl) {
  const url = new URL(baseUrl);
  if (url.port) {
    return Number(url.port);
  }
  return url.protocol === "https:" ? 443 : 80;
}

async function ensureServer(baseUrl) {
  if (await pingServer(baseUrl)) {
    return {
      process: null,
      startedByScript: false,
    };
  }

  const port = resolveDevPort(baseUrl);
  const child = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  const ready = await waitForServer(baseUrl, MAX_SERVER_BOOT_MS);
  if (!ready) {
    child.kill();
    throw new Error(`Dev server did not become ready within ${MAX_SERVER_BOOT_MS}ms at ${baseUrl}.`);
  }

  return {
    process: child,
    startedByScript: true,
  };
}

async function measureFormula(page, formula) {
  const editor = page.locator(".monaco-editor").first();
  await editor.click({ position: { x: 160, y: 42 } });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");

  const waitForMutation = page.evaluate(() => {
    const target = document.querySelector(".vibelatex-formula-content");
    if (!target) {
      throw new Error("Preview node not found.");
    }

    const start = performance.now();

    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        observer.disconnect();
        resolve(performance.now() - start);
      });

      observer.observe(target, {
        childList: true,
        subtree: true,
      });
    });
  });

  await page.keyboard.type(formula);
  const elapsed = await waitForMutation;
  return Math.max(0, Math.round(Number(elapsed)));
}

(async () => {
  const server = await ensureServer(BASE_URL);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    const samples = [];
    for (const formula of FORMULAS) {
      const elapsed = await measureFormula(page, formula);
      samples.push({ formula, elapsed });
    }

    const average = Math.round(
      samples.reduce((sum, sample) => sum + sample.elapsed, 0) / Math.max(1, samples.length),
    );

    console.log("Render latency samples (ms):");
    for (const sample of samples) {
      console.log(`- ${sample.elapsed}ms :: ${sample.formula.slice(0, 48)}`);
    }
    console.log(`Average: ${average}ms`);

    if (average >= 300) {
      console.error(`FAIL: average latency ${average}ms >= 300ms`);
      process.exitCode = 1;
    } else {
      console.log(`PASS: average latency ${average}ms < 300ms`);
    }
  } finally {
    await browser.close();
    if (server.startedByScript && server.process) {
      server.process.kill();
    }
  }
})();
