"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import Link from "next/link";
import { Languages, Moon, Sun } from "lucide-react";

import { AiPanel } from "@/components/ai-panel";
import { EditorPane } from "@/components/editor-pane";
import { ExportToolbar } from "@/components/export-toolbar";
import { MacroPanel } from "@/components/macro-panel";
import { PreviewPane, type PreviewPaneHandle } from "@/components/preview-pane";
import { RecentFormulasPanel } from "@/components/recent-formulas-panel";
import { StylePanel } from "@/components/style-panel";
import { TemplateHistoryPanel } from "@/components/template-history-panel";
import { buttonVariants, Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  canCopyPngToClipboard,
  copyPngBlobToClipboard,
  copyTextToClipboard,
  downloadBlob,
  exportNodeToPng,
  exportNodeToSvg,
  exportNodeToSvgText,
} from "@/lib/export-utils";
import { getErrorLocation, parseErrorPosition, type ErrorLocation } from "@/lib/latex-errors";
import { renderMathJaxToHtml } from "@/lib/mathjax-loader";
import {
  buildMacroMaps,
  loadDraft,
  loadLocalePreference,
  loadMacros,
  loadRecentFormulas,
  loadStylePanelCollapsedPreference,
  loadThemePreference,
  parseTagsInput,
  pushRecentFormula,
  removeMacro,
  saveDraft,
  saveLocalePreference,
  saveMacros,
  saveRecentFormulas,
  saveStylePanelCollapsedPreference,
  saveThemePreference,
  toggleHistoryStar,
  toggleMacroEnabled,
  updateHistoryTags,
  upsertMacro,
} from "@/lib/workspace-store";
import { tr, toggleLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  DEFAULT_LATEX,
  MAX_PADDING,
  type AppTheme,
  type FormulaHistoryItem,
  type MacroDefinition,
  type MetricEvent,
  type ExportFormat,
  type LatexMode,
  type PdfExportOptions,
  type PreviewStyleState,
  type PublicConfig,
  type UiLocale,
} from "@/shared/types";

const INITIAL_STYLE: PreviewStyleState = {
  font_size: 15,
  text_color: "#f8fafc",
  background_mode: "transparent",
  background_color: "#ffffff",
  padding: 16,
  align: "center",
  render_engine: "katex",
  preview_scale: 1,
  export_scale: 2,
  trim: "include_padding",
};

const INITIAL_PDF_OPTIONS: PdfExportOptions = {
  page_size: "A4",
  margin_pt: 24,
  background_mode: "transparent",
};

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}

function normalizePadding(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(MAX_PADDING, Math.round(value)));
}

function isSameHistoryList(left: FormulaHistoryItem[], right: FormulaHistoryItem[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index].id !== right[index].id || left[index].updated_at !== right[index].updated_at) {
      return false;
    }
  }

  return true;
}

function applyTheme(theme: AppTheme): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
}

function resolveThemePreference(): AppTheme {
  if (typeof document !== "undefined") {
    const documentTheme = document.documentElement.dataset.theme;
    if (documentTheme === "dark" || documentTheme === "light") {
      return documentTheme;
    }
  }

  return loadThemePreference();
}

export function Workbench() {
  const [latex, setLatex] = useState("");
  const [locale, setLocale] = useState<UiLocale>("en");
  const [localeReady, setLocaleReady] = useState(false);
  const [mode, setMode] = useState<LatexMode>("block");
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [themeReady, setThemeReady] = useState(false);
  const [stylePanelCollapsed, setStylePanelCollapsed] = useState(false);
  const [stylePanelPreferenceReady, setStylePanelPreferenceReady] = useState(false);
  const [styleState, setStyleState] = useState<PreviewStyleState>(INITIAL_STYLE);
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);
  const [renderedHtml, setRenderedHtml] = useState("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [errorPosition, setErrorPosition] = useState<number | null>(null);
  const [errorLocation, setErrorLocation] = useState<ErrorLocation | null>(null);
  const [recentFormulas, setRecentFormulas] = useState<FormulaHistoryItem[]>([]);
  const [historyTagFilter, setHistoryTagFilter] = useState<string | null>(null);
  const [macros, setMacros] = useState<MacroDefinition[]>([]);
  const [forceRenderNonce, setForceRenderNonce] = useState(0);
  const [editorFocusSignal, setEditorFocusSignal] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [pdfOptions, setPdfOptions] = useState<PdfExportOptions>(INITIAL_PDF_OPTIONS);
  const [pngClipboardSupported, setPngClipboardSupported] = useState(false);

  const rootRef = useRef<HTMLElement | null>(null);
  const previewRef = useRef<PreviewPaneHandle>(null);
  const templatePanelRef = useRef<HTMLDivElement | null>(null);
  const renderRequestRef = useRef(0);
  const forceRenderSourceRef = useRef<string | null>(null);
  const hasRestoredDraftRef = useRef(false);
  const lastGoodHtmlRef = useRef("");
  const lastRenderErrorSignatureRef = useRef("");
  const debouncedLatex = useDebouncedValue(latex, 200);

  const macroMaps = useMemo(() => buildMacroMaps(macros), [macros]);

  const trackMetric = useCallback((event: MetricEvent) => {
    void fetch("/api/metrics/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event }),
    }).catch(() => {
      // Silent telemetry errors.
    });
  }, []);

  const rememberFormula = useCallback((formula: string) => {
    setRecentFormulas((previous) => {
      const next = pushRecentFormula(formula, previous);
      return isSameHistoryList(previous, next) ? previous : next;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((previous) => {
      return previous === "dark" ? "light" : "dark";
    });
  }, []);

  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      hasRestoredDraftRef.current = true;
      setLatex(draft.latex);
      setMode(draft.mode);
      setStyleState((previous) => ({
        ...previous,
        render_engine: draft.render_engine,
      }));
    }

    setRecentFormulas(loadRecentFormulas());
    setMacros(loadMacros());
    setStylePanelCollapsed(loadStylePanelCollapsedPreference());
    setStylePanelPreferenceReady(true);
    setLocale(loadLocalePreference());
    setLocaleReady(true);

    const preferredTheme = resolveThemePreference();
    setTheme(preferredTheme);
    applyTheme(preferredTheme);
    setThemeReady(true);

    setPngClipboardSupported(canCopyPngToClipboard());
  }, []);

  useEffect(() => {
    saveRecentFormulas(recentFormulas);
  }, [recentFormulas]);

  useEffect(() => {
    saveMacros(macros);
  }, [macros]);

  useEffect(() => {
    if (!themeReady) {
      return;
    }
    saveThemePreference(theme);
    applyTheme(theme);
  }, [theme, themeReady]);

  useEffect(() => {
    if (!localeReady) {
      return;
    }
    saveLocalePreference(locale);
  }, [locale, localeReady]);

  useEffect(() => {
    if (!stylePanelPreferenceReady) {
      return;
    }
    saveStylePanelCollapsedPreference(stylePanelCollapsed);
  }, [stylePanelCollapsed, stylePanelPreferenceReady]);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft({
        latex,
        mode,
        render_engine: styleState.render_engine,
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [latex, mode, styleState.render_engine]);

  useEffect(() => {
    const run = async () => {
      try {
        const response = await fetch("/api/config");
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as PublicConfig;
        setPublicConfig(data);
        setStyleState((previous) => ({
          ...previous,
          export_scale: data.default_export_options.scale,
          padding: data.default_export_options.padding,
          background_mode: data.default_export_options.background_mode,
          background_color: data.default_export_options.background_color,
          trim: data.default_export_options.trim,
          render_engine: hasRestoredDraftRef.current
            ? previous.render_engine
            : data.capabilities.mathjax
              ? (data.style_rules?.preferred_render_engine ?? "katex")
              : "katex",
        }));
        setPdfOptions((previous) => ({
          ...previous,
          background_mode: data.default_export_options.background_mode,
        }));
      } catch {
        // Keep defaults.
      }
    };

    void run();
  }, []);

  const mathJaxEnabled = publicConfig?.capabilities.mathjax ?? false;

  useEffect(() => {
    if (!mathJaxEnabled && styleState.render_engine === "mathjax") {
      setStyleState((previous) => ({
        ...previous,
        render_engine: "katex",
      }));
      setExportStatus(
        tr(locale, "MathJax disabled in settings. Switched back to KaTeX.", "设置中已禁用 MathJax，已切回 KaTeX。"),
      );
    }
  }, [locale, mathJaxEnabled, styleState.render_engine]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut =
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "l";

      if (!isShortcut) {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (!target.closest("[data-vibelatex-root='1']")) {
        return;
      }

      event.preventDefault();
      setEditorFocusSignal((previous) => previous + 1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const sourceInput = forceRenderSourceRef.current ?? debouncedLatex;
    forceRenderSourceRef.current = null;
    const sourceIsEmpty = sourceInput.trim().length === 0;
    const source = sourceIsEmpty ? String.raw`x` : sourceInput;
    const requestId = renderRequestRef.current + 1;
    renderRequestRef.current = requestId;

    const render = async () => {
      try {
        const html =
          styleState.render_engine === "mathjax"
            ? await renderMathJaxToHtml(source, mode, macroMaps.mathjax)
            : katex.renderToString(source, {
                displayMode: mode === "block",
                throwOnError: true,
                output: "htmlAndMathml",
                strict: "warn",
                macros: macroMaps.katex,
              });

        if (requestId !== renderRequestRef.current) {
          return;
        }

        setRenderedHtml(html);
        lastGoodHtmlRef.current = html;
        setRenderError(null);
        setErrorPosition(null);
        setErrorLocation(null);
        if (!sourceIsEmpty) {
          rememberFormula(source);
        }
      } catch (error) {
        if (requestId !== renderRequestRef.current) {
          return;
        }

        const baseMessage = error instanceof Error ? error.message : "Unknown render error";
        const message =
          styleState.render_engine === "mathjax"
            ? `MathJax render failed: ${baseMessage}. Try KaTeX mode for better compatibility.`
            : baseMessage;
        const offset =
          styleState.render_engine === "katex" ? parseErrorPosition(message) : null;
        const location = getErrorLocation(source, offset);

        setRenderError(message);
        setErrorPosition(offset);
        setErrorLocation(location);
        setRenderedHtml(lastGoodHtmlRef.current);

        const signature = `${styleState.render_engine}:${message}:${source}`;
        if (lastRenderErrorSignatureRef.current !== signature) {
          lastRenderErrorSignatureRef.current = signature;
          trackMetric("render_failure");
        }
      }
    };

    void render();
  }, [
    debouncedLatex,
    forceRenderNonce,
    macroMaps.katex,
    macroMaps.mathjax,
    mode,
    rememberFormula,
    styleState.render_engine,
    trackMetric,
  ]);

  const hasAiEnabled = useMemo(() => publicConfig?.features_enabled.ai ?? true, [publicConfig]);
  const aiFeatureFlags = useMemo(
    () => ({
      format: publicConfig?.features_enabled.format ?? true,
      fix: publicConfig?.features_enabled.fix ?? true,
      refactor: publicConfig?.features_enabled.refactor ?? true,
      nlToLatex: publicConfig?.features_enabled.nl_to_latex ?? true,
      explain: publicConfig?.features_enabled.explain ?? true,
      imageToLatex: publicConfig?.features_enabled.image_to_latex ?? false,
    }),
    [publicConfig],
  );
  const visionEnabled = publicConfig?.capabilities.vision ?? false;
  const defaultExportFormat = publicConfig?.default_export_options.format ?? "svg";
  const pdfEnabled = publicConfig?.features_enabled.export_pdf ?? true;

  const applyStyle = (next: PreviewStyleState) => {
    setStyleState({
      ...next,
      padding: normalizePadding(next.padding),
      render_engine:
        !mathJaxEnabled && next.render_engine === "mathjax" ? "katex" : next.render_engine,
    });
  };

  const getExportTargetNode = () =>
    styleState.trim === "tight" ? previewRef.current?.tightNode : previewRef.current?.paddedNode;

  const handleExport = async (format: ExportFormat) => {
    const enabled =
      format === "svg"
        ? (publicConfig?.features_enabled.export_svg ?? true)
        : (publicConfig?.features_enabled.export_png ?? true);

    if (!enabled) {
      setExportStatus(
        tr(
          locale,
          `${format.toUpperCase()} export is disabled in settings.`,
          `设置中已禁用 ${format.toUpperCase()} 导出。`,
        ),
      );
      return;
    }

    const targetNode = getExportTargetNode();

    if (!targetNode) {
      setExportStatus(tr(locale, "Preview not ready.", "预览尚未就绪。"));
      return;
    }

    setExporting(true);
    setExportStatus(tr(locale, "Exporting...", "导出中..."));

    try {
      const options = {
        scale: styleState.export_scale,
        backgroundMode: styleState.background_mode,
        backgroundColor: styleState.background_color,
      };

      const blob =
        format === "svg"
          ? await exportNodeToSvg(targetNode, options)
          : await exportNodeToPng(targetNode, options);

      downloadBlob(blob, `vibelatex-${Date.now()}.${format}`);
      setExportStatus(tr(locale, `Exported ${format.toUpperCase()}`, `已导出 ${format.toUpperCase()}`));
      rememberFormula(latex);
      trackMetric(format === "svg" ? "export_svg" : "export_png");
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : tr(locale, "Export failed.", "导出失败。"));
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!pdfEnabled) {
      setExportStatus(tr(locale, "PDF export is disabled in settings.", "设置中已禁用 PDF 导出。"));
      return;
    }

    setExporting(true);
    setExportStatus(tr(locale, "Exporting PDF (Beta)...", "正在导出 PDF（Beta）..."));

    try {
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latex,
          mode,
          style: {
            font_size: styleState.font_size,
            text_color: styleState.text_color,
            background_mode: styleState.background_mode,
            background_color: styleState.background_color,
            padding: styleState.padding,
            align: styleState.align,
          },
          pdf: pdfOptions,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setExportStatus(data?.error ?? tr(locale, "PDF export failed.", "PDF 导出失败。"));
        return;
      }

      const blob = await response.blob();
      downloadBlob(blob, `vibelatex-${Date.now()}.pdf`);
      setExportStatus(
        tr(
          locale,
          "Exported PDF (Beta). SVG remains the default recommended format.",
          "PDF（Beta）已导出。默认仍推荐使用 SVG。",
        ),
      );
      rememberFormula(latex);
      trackMetric("export_pdf");
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : tr(locale, "PDF export failed.", "PDF 导出失败。"));
    } finally {
      setExporting(false);
    }
  };

  const handleCopyLatex = async () => {
    try {
      await copyTextToClipboard(latex);
      setExportStatus(tr(locale, "LaTeX copied.", "LaTeX 已复制。"));
    } catch {
      setExportStatus(tr(locale, "Unable to access clipboard in this context.", "当前环境无法访问剪贴板。"));
    }
  };

  const handleCopySvgText = async () => {
    const targetNode = getExportTargetNode();
    if (!targetNode) {
      setExportStatus(tr(locale, "Preview not ready.", "预览尚未就绪。"));
      return;
    }

    setExporting(true);
    setExportStatus(tr(locale, "Copying SVG...", "正在复制 SVG..."));

    try {
      const svgText = await exportNodeToSvgText(targetNode, {
        scale: styleState.export_scale,
        backgroundMode: styleState.background_mode,
        backgroundColor: styleState.background_color,
      });

      try {
        await copyTextToClipboard(svgText);
        setExportStatus(tr(locale, "SVG text copied.", "SVG 文本已复制。"));
      } catch {
        const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
        downloadBlob(svgBlob, `vibelatex-${Date.now()}.svg`);
        setExportStatus(tr(locale, "Clipboard unavailable; downloaded SVG instead.", "剪贴板不可用，已改为下载 SVG。"));
      }
    } catch {
      setExportStatus(tr(locale, "Copy SVG failed.", "复制 SVG 失败。"));
    } finally {
      setExporting(false);
    }
  };

  const handleCopyPng = async () => {
    const targetNode = getExportTargetNode();
    if (!targetNode) {
      setExportStatus(tr(locale, "Preview not ready.", "预览尚未就绪。"));
      return;
    }

    if (!pngClipboardSupported) {
      setExportStatus(
        tr(
          locale,
          "PNG clipboard is not supported in this context. Downloading PNG instead...",
          "当前环境不支持 PNG 剪贴板，改为下载 PNG...",
        ),
      );
    }

    setExporting(true);
    setExportStatus(tr(locale, "Copying PNG...", "正在复制 PNG..."));

    try {
      const blob = await exportNodeToPng(targetNode, {
        scale: styleState.export_scale,
        backgroundMode: styleState.background_mode,
        backgroundColor: styleState.background_color,
      });

      if (!pngClipboardSupported) {
        downloadBlob(blob, `vibelatex-${Date.now()}.png`);
        setExportStatus(tr(locale, "PNG downloaded (clipboard unavailable).", "PNG 已下载（剪贴板不可用）。"));
        return;
      }

      try {
        await copyPngBlobToClipboard(blob);
        setExportStatus(tr(locale, "PNG copied to clipboard.", "PNG 已复制到剪贴板。"));
      } catch {
        downloadBlob(blob, `vibelatex-${Date.now()}.png`);
        setExportStatus(tr(locale, "Clipboard unavailable; downloaded PNG instead.", "剪贴板不可用，已改为下载 PNG。"));
      }
    } catch {
      setExportStatus(tr(locale, "Copy PNG failed.", "复制 PNG 失败。"));
    } finally {
      setExporting(false);
    }
  };

  const handleForceRender = () => {
    forceRenderSourceRef.current = latex;
    setForceRenderNonce((previous) => previous + 1);
  };

  const handleExportDefault = () => {
    void handleExport(defaultExportFormat);
  };

  const handleApplyAiResult = (nextLatex: string) => {
    setLatex(nextLatex);
    rememberFormula(nextLatex);
  };

  const handleInsertTemplate = (templateLatex: string) => {
    setLatex(templateLatex);
    rememberFormula(templateLatex);
    setEditorFocusSignal((previous) => previous + 1);
  };

  const handleUseHistory = (historyLatex: string) => {
    setLatex(historyLatex);
    setEditorFocusSignal((previous) => previous + 1);
  };

  const handleInsertSampleFormula = () => {
    setLatex(DEFAULT_LATEX);
    rememberFormula(DEFAULT_LATEX);
    setEditorFocusSignal((previous) => previous + 1);
  };

  const handleOpenTemplatePanel = () => {
    templatePanelRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    templatePanelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  };

  const showEmptyStateGuide = latex.trim().length === 0;

  return (
    <main
      ref={rootRef}
      data-vibelatex-root="1"
      className={cn(
        "min-h-screen px-4 py-6 text-slate-100 transition-colors md:px-8",
        theme === "dark"
          ? "bg-[radial-gradient(ellipse_at_top,_#14324f_0%,_#020617_55%)]"
          : "bg-[radial-gradient(ellipse_at_top,_#dbeafe_0%,_#f8fafc_55%)]",
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="rounded-xl border border-slate-800/80 bg-slate-900/75 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-slate-100">VibeLaTeX</h1>
              <p className="text-sm text-slate-400">
                {tr(
                  locale,
                  "Real-time LaTeX rendering, AI tools, templates/history, and transparent export.",
                  "实时 LaTeX 渲染、AI 工具、模板/历史与透明导出。",
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link href="/admin" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                {tr(locale, "Settings", "设置")}
              </Link>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setLocale((previous) => toggleLocale(previous))}
                title={tr(locale, "Switch language", "切换语言")}
              >
                <Languages className="mr-1 h-3.5 w-3.5" />
                {locale === "en" ? "中文" : "EN"}
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={toggleTheme}
                title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              >
                {theme === "dark" ? (
                  <Sun className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <Moon className="mr-1 h-3.5 w-3.5" />
                )}
                {theme === "dark" ? tr(locale, "Light", "浅色") : tr(locale, "Dark", "深色")}
              </Button>

              <div className="flex rounded-md border border-slate-700 bg-slate-950 p-0.5 text-xs">
                <button
                  type="button"
                  className={`rounded px-3 py-1 ${mode === "block" ? "bg-emerald-500 text-slate-950" : "text-slate-300"}`}
                  onClick={() => setMode("block")}
                >
                  {tr(locale, "Block", "块级")}
                </button>
                <button
                  type="button"
                  className={`rounded px-3 py-1 ${mode === "inline" ? "bg-emerald-500 text-slate-950" : "text-slate-300"}`}
                  onClick={() => setMode("inline")}
                >
                  {tr(locale, "Inline", "行内")}
                </button>
              </div>
            </div>

            <ExportToolbar
              locale={locale}
              busy={exporting}
              status={exportStatus}
              canCopyPng={pngClipboardSupported}
              pdfEnabled={pdfEnabled}
              pdfOptions={pdfOptions}
              onExport={(format) => void handleExport(format)}
              onExportPdf={() => void handleExportPdf()}
              onPdfOptionsChange={setPdfOptions}
              onCopyLatex={() => void handleCopyLatex()}
              onCopySvgText={() => void handleCopySvgText()}
              onCopyPng={() => void handleCopyPng()}
            />
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0 space-y-4">
            <EditorPane
              locale={locale}
              value={latex}
              mode={mode}
              theme={theme}
              errorPosition={errorPosition}
              errorMessage={renderError}
              errorLine={errorLocation?.line ?? null}
              errorColumn={errorLocation?.column ?? null}
              focusSignal={editorFocusSignal}
              onForceRender={handleForceRender}
              onExportDefault={handleExportDefault}
              onChange={setLatex}
            />

            {showEmptyStateGuide ? (
              <Card data-testid="editor-empty-state" className="space-y-3 border-dashed border-emerald-500/50">
                <div>
                  <CardTitle>{tr(locale, "Start with a sample formula", "从示例公式开始")}</CardTitle>
                  <CardDescription>
                    {tr(
                      locale,
                      "The editor is empty. Load a sample or jump to templates to begin quickly.",
                      "编辑器当前为空。你可以加载示例公式，或跳转到模板快速开始。",
                    )}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={handleInsertSampleFormula}>
                    {tr(locale, "Use sample formula", "使用示例公式")}
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={handleOpenTemplatePanel}>
                    {tr(locale, "Jump to templates", "跳转到模板")}
                  </Button>
                </div>
              </Card>
            ) : null}

            <PreviewPane
              locale={locale}
              ref={previewRef}
              renderedHtml={renderedHtml}
              errorMessage={renderError}
              styleState={styleState}
            />
            <Card className="space-y-2" data-testid="settings-panel-toggle">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>{tr(locale, "Settings Panel", "设置面板")}</CardTitle>
                  <CardDescription>{tr(locale, "Collapse when you want to focus on editor and preview.", "需要专注编辑与预览时可折叠。")}</CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-expanded={!stylePanelCollapsed}
                  aria-controls="style-settings-body"
                  onClick={() => setStylePanelCollapsed((previous) => !previous)}
                >
                  {stylePanelCollapsed
                    ? tr(locale, "Expand settings", "展开设置")
                    : tr(locale, "Collapse settings", "折叠设置")}
                </Button>
              </div>
            </Card>

            {!stylePanelCollapsed ? (
              <div id="style-settings-body" data-testid="style-settings-body">
                <StylePanel locale={locale} value={styleState} mathJaxEnabled={mathJaxEnabled} onChange={applyStyle} />
              </div>
            ) : (
              <Card id="style-settings-body" className="border-dashed border-slate-700/80">
                <CardDescription>
                  {tr(
                    locale,
                    "Settings are collapsed. Expand the panel to adjust render engine, style, and export options.",
                    "设置面板已折叠。展开后可调整渲染引擎、样式和导出选项。",
                  )}
                </CardDescription>
              </Card>
            )}

            <div ref={templatePanelRef} data-testid="template-panel">
              <TemplateHistoryPanel locale={locale} onUseTemplate={handleInsertTemplate} />
            </div>

            <MacroPanel
              locale={locale}
              macros={macros}
              onAddMacro={(name, expansion) => {
                setMacros((previous) =>
                  upsertMacro(
                    {
                      id: "",
                      name,
                      expansion,
                      enabled: true,
                    },
                    previous,
                  ),
                );
              }}
              onUpdateMacro={(macro) => {
                setMacros((previous) => upsertMacro(macro, previous));
              }}
              onToggleMacro={(id) => {
                setMacros((previous) => toggleMacroEnabled(id, previous));
              }}
              onDeleteMacro={(id) => {
                setMacros((previous) => removeMacro(id, previous));
              }}
            />

          </div>

          <div className="min-w-0 space-y-4">
            {hasAiEnabled ? (
              <AiPanel
                locale={locale}
                latex={latex}
                renderError={renderError}
                visionEnabled={visionEnabled}
                featureFlags={aiFeatureFlags}
                onTrackAiCall={() => trackMetric("ai_call")}
                onApply={handleApplyAiResult}
              />
            ) : (
              <Card>
                <CardTitle>{tr(locale, "AI disabled", "AI 已禁用")}</CardTitle>
                <CardDescription>
                  {tr(locale, "Enable AI features in /admin to use format and fix actions.", "请在 /admin 启用 AI 功能后使用格式化与修复动作。")}
                </CardDescription>
              </Card>
            )}

            <RecentFormulasPanel
              locale={locale}
              history={recentFormulas}
              activeTag={historyTagFilter}
              onSetActiveTag={setHistoryTagFilter}
              onUseHistory={handleUseHistory}
              onClearHistory={() => {
                setRecentFormulas([]);
                setHistoryTagFilter(null);
              }}
              onToggleStar={(id) => {
                setRecentFormulas((previous) => toggleHistoryStar(id, previous));
              }}
              onUpdateTags={(id, tagsInput) => {
                setRecentFormulas((previous) =>
                  updateHistoryTags(id, parseTagsInput(tagsInput), previous),
                );
              }}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
