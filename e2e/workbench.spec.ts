import { expect, test, type Page } from "@playwright/test";

const DEFAULT_PUBLIC_CONFIG = {
  capabilities: {
    vision: false,
    mathjax: false,
  },
  features_enabled: {
    ai: true,
    format: true,
    fix: true,
    refactor: true,
    nl_to_latex: true,
    explain: true,
    export_svg: true,
    export_png: true,
    export_pdf: true,
    image_to_latex: false,
  },
  default_export_options: {
    format: "svg",
    scale: 2,
    padding: 16,
    background_mode: "transparent",
    background_color: "#ffffff",
    trim: "include_padding",
  },
  style_rules: {
    preferred_render_engine: "katex",
  },
  security: {
    admin_protected: false,
  },
};

async function mockPublicConfig(
  page: Page,
  overrides?: {
    capabilities?: Partial<(typeof DEFAULT_PUBLIC_CONFIG)["capabilities"]>;
    features_enabled?: Partial<(typeof DEFAULT_PUBLIC_CONFIG)["features_enabled"]>;
  },
) {
  await page.route("**/api/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...DEFAULT_PUBLIC_CONFIG,
        capabilities: {
          ...DEFAULT_PUBLIC_CONFIG.capabilities,
          ...overrides?.capabilities,
        },
        features_enabled: {
          ...DEFAULT_PUBLIC_CONFIG.features_enabled,
          ...overrides?.features_enabled,
        },
      }),
    });
  });
}

async function buildPngDataUrl(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context unavailable");
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#0f172a";
    ctx.font = "26px sans-serif";
    ctx.fillText("∑", 16, 42);
    return canvas.toDataURL("image/png");
  });
}

async function uploadGeneratedImage(page: Page, fileName: string) {
  const dataUrl = await buildPngDataUrl(page);
  const payload = dataUrl.split(",")[1] ?? "";
  await page
    .locator('input[type="file"][accept="image/png,image/jpeg,image/webp"]')
    .setInputFiles({
      name: fileName,
      mimeType: "image/png",
      buffer: Buffer.from(payload, "base64"),
    });
}

test("workbench renders and updates formula", async ({ page }) => {
  await mockPublicConfig(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "VibeLaTeX" })).toBeVisible();

  const editor = page.locator(".monaco-editor").first();
  await editor.click({ position: { x: 160, y: 160 } });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type("x^2 + y^2");

  await expect(page.locator(".katex").first()).toBeVisible();
  await expect(page.getByText("SVG", { exact: true })).toBeVisible();
  await expect(page.getByText("PNG", { exact: true })).toBeVisible();
});

test("empty editor state offers sample formula entry", async ({ page }) => {
  await mockPublicConfig(page);
  await page.goto("/");

  await expect(page.getByTestId("editor-empty-state")).toBeVisible();
  await page.getByRole("button", { name: "Use sample formula" }).click();

  await expect(page.getByTestId("editor-empty-state")).toHaveCount(0);
  await expect(page.locator(".view-lines").first()).toContainText("f(x)");
});

test("settings panel supports collapse and expand", async ({ page }) => {
  await mockPublicConfig(page);
  await page.goto("/");

  await expect(page.locator("#render-engine")).toBeVisible();
  await page.getByRole("button", { name: "Collapse settings" }).click();

  await expect(page.getByRole("button", { name: "Expand settings" })).toBeVisible();
  await expect(page.locator("#render-engine")).toHaveCount(0);
  await expect(
    page.getByText("Settings are collapsed. Expand the panel to adjust render engine, style, and export options."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Expand settings" }).click();
  await expect(page.locator("#render-engine")).toBeVisible();
});

test("language switch toggles zh/en and persists on reload", async ({ page }) => {
  await mockPublicConfig(page);
  await page.goto("/");

  await page.getByRole("button", { name: "中文" }).click();
  await expect(page.getByRole("link", { name: "设置" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI 助手" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^EN$/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: "设置" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^EN$/ })).toBeVisible();
});

test("preview supports horizontal scroll for long formulas", async ({ page }) => {
  await mockPublicConfig(page);
  await page.goto("/");

  if (await page.getByTestId("editor-empty-state").isVisible()) {
    await page.getByRole("button", { name: "Use sample formula" }).click();
  }

  const longLatex = Array.from({ length: 120 }, (_, index) => `x_{${index + 1}}`).join("+");
  const editor = page.locator(".monaco-editor").first();
  await editor.click({ position: { x: 160, y: 160 } });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type(longLatex);

  const previewScroll = page.locator(".vibelatex-preview-scroll").first();
  await expect(previewScroll).toBeVisible();

  await expect.poll(async () => {
    return page.evaluate(() => {
      const outer = document.querySelector<HTMLElement>(".vibelatex-preview-scroll");
      const inner = document.querySelector<HTMLElement>(".vibelatex-formula-content .katex-display");
      const outerOverflow = Boolean(outer && outer.scrollWidth > outer.clientWidth);
      const innerOverflow = Boolean(inner && inner.scrollWidth > inner.clientWidth);
      return outerOverflow || innerOverflow;
    });
  }).toBe(true);
});

test("ai assistant is rendered in a separate right column", async ({ page }) => {
  await page.goto("/");

  const panelPositions = await page.evaluate(() => {
    const aiTitle = Array.from(document.querySelectorAll("h3")).find(
      (node) => node.textContent?.trim() === "AI Assistant",
    );
    const editorLabel = Array.from(document.querySelectorAll("span")).find(
      (node) => node.textContent?.trim() === "Editor (Display mode)",
    );

    return {
      aiLeft: aiTitle?.getBoundingClientRect().left ?? 0,
      editorLeft: editorLabel?.getBoundingClientRect().left ?? 0,
    };
  });

  expect(panelPositions.aiLeft).toBeGreaterThan(panelPositions.editorLeft + 200);
});

test("export svg triggers browser download", async ({ page }) => {
  await page.goto("/");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "SVG", exact: true }).click(),
  ]);

  expect(download.suggestedFilename()).toContain(".svg");
});

test("ai panel supports new action and diff preview", async ({ page }) => {
  await page.route("**/api/llm/action/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson; charset=utf-8",
      body: [
        JSON.stringify({ type: "delta", text: "{\"latex\":\"" }),
        JSON.stringify({
          type: "done",
          result: {
            ok: true,
            latex: String.raw`\sum_{k=1}^{n}k=\frac{n(n+1)}{2}`,
            changes: ["Converted NL to canonical summation"],
            explanation: "Generated a standard finite sum identity.",
          },
        }),
      ].join("\n"),
    });
  });

  await page.goto("/");
  await page
    .getByPlaceholder("Describe the formula you want, e.g. sum of geometric series.")
    .fill("sum from 1 to n");
  await page.getByRole("button", { name: "NL → LaTeX" }).click();

  await expect(page.getByText("Diff preview")).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply whole result" })).toBeEnabled();
  await expect(page.getByText("Preview", { exact: true })).toBeVisible();
  await expect(page.getByText("Style", { exact: true })).toBeVisible();
});

test("admin page supports save and metrics viewing", async ({ page }) => {
  await page.route("**/api/admin/save-config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/admin/metrics", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        metrics: {
          version: 1,
          ai_calls: 7,
          export_svg: 3,
          export_png: 2,
          export_pdf: 1,
          render_failure: 1,
          updated_at: "2026-02-23T09:00:00.000Z",
        },
      }),
    });
  });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "VibeLaTeX Admin" })).toBeVisible();

  await page.getByRole("button", { name: "Save & Apply" }).click();
  await expect(page.getByText("Saved and applied.")).toBeVisible();

  await page.getByRole("button", { name: "View Usage Metrics" }).click();
  await expect(page.getByText("AI calls: 7")).toBeVisible();
});

test("diff segmented apply updates editor with accepted block", async ({ page }) => {
  await page.route("**/api/llm/action/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson; charset=utf-8",
      body: JSON.stringify({
        type: "done",
        result: {
          ok: true,
          latex: "x + y",
          changes: ["normalized spacing"],
        },
      }),
    });
  });

  await page.goto("/");

  const editor = page.locator(".monaco-editor").first();
  await editor.click({ position: { x: 160, y: 160 } });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type("x+y");

  await page.getByRole("button", { name: "Format" }).click();
  await expect(page.getByText("Change block #1")).toBeVisible();

  await page.getByRole("button", { name: "Accept" }).first().click();
  await page.getByRole("button", { name: "Apply accepted segments" }).click();

  await expect(page.locator(".view-lines").first()).toContainText("x + y");
});

test("macro panel can add macro and keep render successful", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("New macro name").fill("\\\\RR");
  await page.getByLabel("New macro expansion").fill("\\\\mathbb{R}");
  await page.getByRole("button", { name: "Add" }).click();

  const editor = page.locator(".monaco-editor").first();
  await editor.click({ position: { x: 160, y: 160 } });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type("\\\\RR + 1");

  await expect(page.getByText("Render OK")).toBeVisible();
});

test("history tags can be edited and filtered", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "vibelatex:history:v1",
      JSON.stringify({
        version: 2,
        items: [
          {
            id: "h1",
            latex: "x+y",
            starred: false,
            tags: [],
            created_at: "2026-02-23T09:00:00.000Z",
            updated_at: "2026-02-23T09:00:00.000Z",
          },
        ],
      }),
    );
  });

  await page.goto("/");
  const tagInput = page.getByLabel("Edit tags").first();
  await tagInput.fill("algebra");
  await tagInput.press("Enter");

  await expect(page.getByRole("button", { name: "#algebra" })).toBeVisible();
  await page.getByRole("button", { name: "#algebra" }).click();
  await expect(page.getByText("No formulas match current tag filter.")).toHaveCount(0);
});

test("theme toggle switches data-theme attribute", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Light" }).click();
  await expect.poll(async () =>
    page.evaluate(() => document.documentElement.dataset.theme),
  ).toBe("light");

  await page.getByRole("button", { name: "Dark" }).click();
  await expect.poll(async () =>
    page.evaluate(() => document.documentElement.dataset.theme),
  ).toBe("dark");
});

test("light theme remains when navigating to admin", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Light" }).click();
  await expect.poll(async () =>
    page.evaluate(() => document.documentElement.dataset.theme),
  ).toBe("light");

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect.poll(async () =>
    page.evaluate(() => document.documentElement.dataset.theme),
  ).toBe("light");
  await expect(page.locator("main.admin-page-bg")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dark" })).toBeVisible();

  await page.getByRole("link", { name: "Back to Editor" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(async () =>
    page.evaluate(() => document.documentElement.dataset.theme),
  ).toBe("light");
  await expect(page.getByRole("button", { name: "Dark" })).toBeVisible();
});

const MOBILE_VIEWPORTS = [
  { label: "390x844", width: 390, height: 844 },
  { label: "430x932", width: 430, height: 932 },
];

for (const viewport of MOBILE_VIEWPORTS) {
  test(`mobile viewport ${viewport.label} supports browse and copy`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => {
      const state = { copied: "" };
      Object.defineProperty(window, "__vibelatexClipboardState", {
        configurable: true,
        value: state,
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            state.copied = value;
          },
          write: async () => {},
        },
      });
    });

    await mockPublicConfig(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "VibeLaTeX" })).toBeVisible();
    if (await page.getByTestId("editor-empty-state").isVisible()) {
      await page.getByRole("button", { name: "Use sample formula" }).click();
    }

    await page.getByRole("button", { name: "Copy LaTeX" }).click();
    await expect(page.getByText("LaTeX copied.")).toBeVisible();

    const copied = await page.evaluate(() => {
      return (
        (window as unknown as { __vibelatexClipboardState?: { copied?: string } })
          .__vibelatexClipboardState?.copied ?? ""
      );
    });

    expect(copied).toContain("\\begin{aligned}");
  });
}

test("restores recent history from localStorage and allows quick apply", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "vibelatex:history:v1",
      JSON.stringify({
        version: 1,
        formulas: ["x+y", "\\frac{1}{2}"],
      }),
    );
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "x+y" })).toBeVisible();
  await page.getByRole("button", { name: "x+y" }).click();

  await expect(page.locator(".view-lines").first()).toContainText("x+y");
});

test("restores draft from localStorage on page load", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "vibelatex:draft:v1",
      JSON.stringify({
        version: 1,
        latex: "\\\\int_0^1 x^2 dx",
        mode: "inline",
        render_engine: "katex",
        updated_at: "2026-02-23T09:00:00.000Z",
      }),
    );
  });

  await page.goto("/");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await expect(page.locator(".view-lines").first()).toContainText("\\int_0^1 x^2 dx");
});

test("image upload entry reaches success state", async ({ page }) => {
  await mockPublicConfig(page, {
    capabilities: { vision: true },
    features_enabled: { image_to_latex: true },
  });
  await page.goto("/");

  await uploadGeneratedImage(page, "upload-formula.png");
  await expect(page.getByTestId("image-input-state")).toContainText("success");
});

test("image drag-and-drop entry can trigger img_to_latex action", async ({ page }) => {
  await mockPublicConfig(page, {
    capabilities: { vision: true },
    features_enabled: { image_to_latex: true },
  });
  await page.route("**/api/llm/action/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson; charset=utf-8",
      body: JSON.stringify({
        type: "done",
        result: {
          ok: true,
          latex: String.raw`\frac{a}{b}`,
          changes: ["ocr"],
        },
      }),
    });
  });
  await page.goto("/");
  await expect(page.getByTestId("image-dropzone")).toBeVisible();

  await page.evaluate(async () => {
    const dropzone = document.querySelector<HTMLElement>('[data-testid="image-dropzone"]');
    if (!dropzone) {
      throw new Error("Missing image dropzone");
    }

    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Missing canvas context");
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 64, 64);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      throw new Error("Failed to generate image blob");
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([blob], "drop-formula.png", { type: "image/png" }));
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      }),
    );
  });

  await expect(page.getByTestId("image-input-state")).toContainText("success");
  await page.getByRole("button", { name: "Image → LaTeX" }).click();
  await expect(page.getByRole("button", { name: "Apply whole result" })).toBeEnabled();
});

test("image paste entry reaches success state", async ({ page }) => {
  await mockPublicConfig(page, {
    capabilities: { vision: true },
    features_enabled: { image_to_latex: true },
  });
  await page.goto("/");

  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Missing canvas context");
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 64, 64);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      throw new Error("Failed to generate image blob");
    }

    const clipboardData = new DataTransfer();
    clipboardData.items.add(new File([blob], "paste-formula.png", { type: "image/png" }));
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", { value: clipboardData });
    window.dispatchEvent(pasteEvent);
  });

  await expect(page.getByTestId("image-input-state")).toContainText("success");
});

test("image drop rejects non-image and supports fallback actions", async ({ page }) => {
  await mockPublicConfig(page, {
    capabilities: { vision: true },
    features_enabled: { image_to_latex: true },
  });
  await page.goto("/");
  await expect(page.getByTestId("image-dropzone")).toBeVisible();

  await page.evaluate(() => {
    const dropzone = document.querySelector<HTMLElement>('[data-testid="image-dropzone"]');
    if (!dropzone) {
      throw new Error("Missing image dropzone");
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(["not-image"], "not-image.txt", { type: "text/plain" }));
    dropzone.dispatchEvent(
      new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      }),
    );
  });

  await expect(page.getByText("Only PNG/JPG/WebP images are supported.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry image input" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to text input" }).click();
  await expect(page.getByTestId("image-input-state")).toContainText("idle");
});

test("vision-disabled image input shows admin guidance", async ({ page }) => {
  await mockPublicConfig(page, {
    capabilities: { vision: false },
    features_enabled: { image_to_latex: true },
  });
  await page.goto("/");

  await expect(
    page.getByText("Enable Vision and image_to_latex in /admin."),
  ).toBeVisible();
});

test("pdf beta export triggers browser download", async ({ page }) => {
  await mockPublicConfig(page);
  await page.route("**/api/export/pdf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      headers: {
        "Content-Disposition": 'attachment; filename="vibelatex-test.pdf"',
      },
      body: "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF",
    });
  });
  await page.goto("/");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /^(Download PDF|下载 PDF)$/ }).click(),
  ]);

  expect(download.suggestedFilename()).toContain(".pdf");
});

test("pdf beta export surfaces backend failure", async ({ page }) => {
  await mockPublicConfig(page);
  await page.route("**/api/export/pdf", async (route) => {
    await route.fulfill({
      status: 504,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        code: "timeout",
        error: "PDF rendering timed out.",
      }),
    });
  });
  await page.goto("/");

  await page.getByRole("button", { name: /^(Download PDF|下载 PDF)$/ }).click();
  await expect(page.getByText("PDF rendering timed out.")).toBeVisible();
});

test("copy svg falls back to download when clipboard is denied", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("NotAllowedError");
        },
        write: async () => {
          throw new Error("NotAllowedError");
        },
      },
    });
    Object.defineProperty(window, "ClipboardItem", {
      configurable: true,
      value: class ClipboardItemMock {
        items: Record<string, Blob>;

        constructor(items: Record<string, Blob>) {
          this.items = items;
        }
      },
    });
  });

  await mockPublicConfig(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Copy SVG" }).click();
  await expect(
    page.getByText(/SVG text copied\.|Clipboard unavailable; downloaded SVG instead\./),
  ).toBeVisible();
});

test("copy png falls back to download when clipboard is denied", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("NotAllowedError");
        },
        write: async () => {
          throw new Error("NotAllowedError");
        },
      },
    });
    Object.defineProperty(window, "ClipboardItem", {
      configurable: true,
      value: class ClipboardItemMock {
        items: Record<string, Blob>;

        constructor(items: Record<string, Blob>) {
          this.items = items;
        }
      },
    });
  });

  await mockPublicConfig(page);
  await page.goto("/");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Copy PNG" }).click(),
  ]);

  expect(download.suggestedFilename()).toContain(".png");
  await expect(page.getByText("Clipboard unavailable; downloaded PNG instead.")).toBeVisible();
});
