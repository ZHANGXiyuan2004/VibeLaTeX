"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Languages, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  loadLocalePreference,
  loadThemePreference,
  saveLocalePreference,
  saveThemePreference,
} from "@/lib/workspace-store";
import { tr, toggleLocale } from "@/lib/i18n";
import type { AppConfig, AppTheme, ErrorLogEntry, MetricsSnapshot, RenderEngine, UiLocale } from "@/shared/types";

interface AdminPanelProps {
  initialConfig: AppConfig;
  adminProtected: boolean;
}

function prettyHeaders(headers: Record<string, string>): string {
  return JSON.stringify(headers, null, 2);
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

function applyTheme(theme: AppTheme): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.theme = theme;
}

function normalizeRetryAttempts(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, Math.trunc(value)));
}

export function AdminPanel({ initialConfig, adminProtected }: AdminPanelProps) {
  const [locale, setLocale] = useState<UiLocale>("en");
  const [localeReady, setLocaleReady] = useState(false);
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [themeReady, setThemeReady] = useState(false);
  const [baseUrl, setBaseUrl] = useState(initialConfig.provider.base_url);
  const [apiKey, setApiKey] = useState(initialConfig.provider.api_key);
  const [model, setModel] = useState(initialConfig.provider.model);
  const [timeout, setTimeoutValue] = useState(initialConfig.provider.timeout);
  const [retryAttempts, setRetryAttempts] = useState(
    normalizeRetryAttempts(initialConfig.provider.retry_attempts),
  );
  const [retryBackoffMs, setRetryBackoffMs] = useState(initialConfig.provider.retry_backoff_ms);
  const [headersText, setHeadersText] = useState(prettyHeaders(initialConfig.provider.headers));
  const [vision, setVision] = useState(initialConfig.capabilities.vision);
  const [mathjaxCapability, setMathjaxCapability] = useState(initialConfig.capabilities.mathjax);
  const [styleProfile, setStyleProfile] = useState(initialConfig.style_rules.style_profile);
  const [enforceKatex, setEnforceKatex] = useState(initialConfig.style_rules.enforce_katex_compatible);
  const [preferredRenderEngine, setPreferredRenderEngine] = useState<RenderEngine>(
    initialConfig.style_rules.preferred_render_engine,
  );
  const [featureAi, setFeatureAi] = useState(initialConfig.features_enabled.ai);
  const [featureFormat, setFeatureFormat] = useState(initialConfig.features_enabled.format);
  const [featureFix, setFeatureFix] = useState(initialConfig.features_enabled.fix);
  const [featureRefactor, setFeatureRefactor] = useState(initialConfig.features_enabled.refactor);
  const [featureNlToLatex, setFeatureNlToLatex] = useState(initialConfig.features_enabled.nl_to_latex);
  const [featureExplain, setFeatureExplain] = useState(initialConfig.features_enabled.explain);
  const [featureExportSvg, setFeatureExportSvg] = useState(initialConfig.features_enabled.export_svg);
  const [featureExportPng, setFeatureExportPng] = useState(initialConfig.features_enabled.export_png);
  const [featureExportPdf, setFeatureExportPdf] = useState(initialConfig.features_enabled.export_pdf);
  const [featureImageToLatex, setFeatureImageToLatex] = useState(
    initialConfig.features_enabled.image_to_latex,
  );
  const [status, setStatus] = useState("");
  const [testStatus, setTestStatus] = useState("");
  const [recentErrors, setRecentErrors] = useState<ErrorLogEntry[]>([]);
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [busySave, setBusySave] = useState(false);
  const [busyTest, setBusyTest] = useState(false);
  const [busyMetrics, setBusyMetrics] = useState(false);

  const toggleTheme = useCallback(() => {
    setTheme((previous) => {
      return previous === "dark" ? "light" : "dark";
    });
  }, []);

  useEffect(() => {
    const preferredTheme = resolveThemePreference();
    setTheme(preferredTheme);
    applyTheme(preferredTheme);
    setThemeReady(true);
    setLocale(loadLocalePreference());
    setLocaleReady(true);
  }, []);

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
    if (!mathjaxCapability && preferredRenderEngine === "mathjax") {
      setPreferredRenderEngine("katex");
    }
  }, [mathjaxCapability, preferredRenderEngine]);

  const payload = useMemo(() => {
    let parsedHeaders: Record<string, string> = {};
    try {
      parsedHeaders = JSON.parse(headersText) as Record<string, string>;
    } catch {
      parsedHeaders = {};
    }

    return {
      provider: {
        base_url: baseUrl,
        api_key: apiKey,
        model,
        timeout,
        retry_attempts: retryAttempts,
        retry_backoff_ms: retryBackoffMs,
        headers: parsedHeaders,
      },
      capabilities: {
        vision,
        mathjax: mathjaxCapability,
      },
      style_rules: {
        enforce_katex_compatible: enforceKatex,
        style_profile: styleProfile,
        preferred_render_engine: preferredRenderEngine,
      },
      features_enabled: {
        ai: featureAi,
        format: featureFormat,
        fix: featureFix,
        refactor: featureRefactor,
        nl_to_latex: featureNlToLatex,
        explain: featureExplain,
        export_svg: featureExportSvg,
        export_png: featureExportPng,
        export_pdf: featureExportPdf,
        image_to_latex: featureImageToLatex,
      },
    };
  }, [
    apiKey,
    baseUrl,
    enforceKatex,
    featureAi,
    featureExplain,
    featureFix,
    featureFormat,
    featureExportPdf,
    featureImageToLatex,
    featureNlToLatex,
    featureRefactor,
    featureExportPng,
    featureExportSvg,
    headersText,
    mathjaxCapability,
    model,
    preferredRenderEngine,
    styleProfile,
    timeout,
    retryAttempts,
    retryBackoffMs,
    vision,
  ]);

  const saveConfig = async () => {
    setBusySave(true);
    setStatus("");

    try {
      JSON.parse(headersText);
    } catch {
      setStatus(tr(locale, "Headers must be valid JSON.", "Headers 必须是合法 JSON。"));
      setBusySave(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/save-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setStatus(data.error ?? tr(locale, "Save failed.", "保存失败。"));
        return;
      }

      setStatus(tr(locale, "Saved and applied.", "已保存并生效。"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : tr(locale, "Save failed.", "保存失败。"));
    } finally {
      setBusySave(false);
    }
  };

  const testConnection = async () => {
    setBusyTest(true);
    setTestStatus("");

    try {
      const response = await fetch("/api/admin/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok) {
        setTestStatus(data.error ?? data.message ?? tr(locale, "Connection failed.", "连接失败。"));
        return;
      }

      setTestStatus(
        data.message ??
          (data.ok
            ? tr(locale, "Connection succeeded.", "连接成功。")
            : tr(locale, "Connection failed.", "连接失败。")),
      );
    } catch (error) {
      setTestStatus(error instanceof Error ? error.message : tr(locale, "Connection failed.", "连接失败。"));
    } finally {
      setBusyTest(false);
    }
  };

  const loadErrors = async () => {
    try {
      const response = await fetch("/api/admin/errors?limit=20");
      const data = (await response.json()) as { errors?: ErrorLogEntry[] };
      setRecentErrors(data.errors ?? []);
    } catch {
      setRecentErrors([]);
    }
  };

  const loadMetrics = async () => {
    setBusyMetrics(true);

    try {
      const response = await fetch("/api/admin/metrics");
      const data = (await response.json()) as { metrics?: MetricsSnapshot };
      setMetrics(data.metrics ?? null);
    } catch {
      setMetrics(null);
    } finally {
      setBusyMetrics(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", {
      method: "POST",
    });
    window.location.reload();
  };

  return (
    <main
      className="admin-page-bg min-h-screen px-4 py-6 text-slate-100 md:px-8"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/75 p-4 backdrop-blur-sm">
          <div>
            <h1 className="text-xl font-semibold">VibeLaTeX Admin</h1>
            <p className="text-sm text-slate-400">
              {tr(locale, "Configure LLM provider, feature flags, and diagnostics.", "配置 LLM Provider、功能开关与诊断信息。")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLocale((previous) => toggleLocale(previous))}
            >
              <Languages className="mr-1 h-3.5 w-3.5" />
              {locale === "en" ? "中文" : "EN"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <Sun className="mr-1 h-3.5 w-3.5" />
              ) : (
                <Moon className="mr-1 h-3.5 w-3.5" />
              )}
              {theme === "dark" ? tr(locale, "Light", "浅色") : tr(locale, "Dark", "深色")}
            </Button>
            <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {tr(locale, "Back to Editor", "返回编辑器")}
            </Link>
            {adminProtected ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => void logout()}>
                {tr(locale, "Logout", "退出登录")}
              </Button>
            ) : null}
          </div>
        </header>

        <Card className="space-y-4">
          <div>
            <CardTitle>{tr(locale, "Provider", "服务提供方")}</CardTitle>
            <CardDescription>{tr(locale, "OpenAI Chat compatible endpoint", "兼容 OpenAI Chat 的接口地址")}</CardDescription>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="base-url">Base URL</Label>
              <Input id="base-url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="api-key">{tr(locale, "API Key", "API 密钥")}</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="model">{tr(locale, "Model", "模型")}</Label>
              <Input id="model" value={model} onChange={(event) => setModel(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="timeout">{tr(locale, "Timeout (ms)", "超时（毫秒）")}</Label>
              <Input
                id="timeout"
                type="number"
                value={timeout}
                onChange={(event) => setTimeoutValue(Number(event.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="retry-attempts">{tr(locale, "Retry Attempts (max 1)", "重试次数（最多 1 次）")}</Label>
              <Input
                id="retry-attempts"
                type="number"
                min={0}
                max={1}
                value={retryAttempts}
                onChange={(event) => setRetryAttempts(normalizeRetryAttempts(Number(event.target.value)))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="retry-backoff">{tr(locale, "Retry Backoff (ms)", "重试退避（毫秒）")}</Label>
              <Input
                id="retry-backoff"
                type="number"
                min={100}
                max={30000}
                value={retryBackoffMs}
                onChange={(event) => setRetryBackoffMs(Number(event.target.value))}
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="headers">{tr(locale, "Headers JSON", "Headers JSON")}</Label>
              <Textarea
                id="headers"
                className="min-h-28"
                value={headersText}
                onChange={(event) => setHeadersText(event.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <CardTitle>{tr(locale, "Capabilities and Features", "能力与功能开关")}</CardTitle>
          </div>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={vision} onChange={(event) => setVision(event.target.checked)} />
              {tr(locale, "vision capability", "vision 能力")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={mathjaxCapability}
                onChange={(event) => setMathjaxCapability(event.target.checked)}
              />
              {tr(locale, "mathjax capability", "mathjax 能力")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={enforceKatex}
                onChange={(event) => setEnforceKatex(event.target.checked)}
              />
              {tr(locale, "enforce KaTeX compatibility", "强制 KaTeX 兼容")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={featureAi}
                onChange={(event) => setFeatureAi(event.target.checked)}
              />
              {tr(locale, "AI enabled", "启用 AI")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={featureFormat}
                onChange={(event) => setFeatureFormat(event.target.checked)}
              />
              {tr(locale, "format action", "格式化动作")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={featureFix}
                onChange={(event) => setFeatureFix(event.target.checked)}
              />
              {tr(locale, "fix action", "修复动作")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={featureRefactor}
                onChange={(event) => setFeatureRefactor(event.target.checked)}
              />
              {tr(locale, "refactor action", "重构动作")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={featureNlToLatex}
                onChange={(event) => setFeatureNlToLatex(event.target.checked)}
              />
              {tr(locale, "nl_to_latex action", "nl_to_latex 动作")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={featureExplain}
                onChange={(event) => setFeatureExplain(event.target.checked)}
              />
              {tr(locale, "explain action", "explain 动作")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={featureExportSvg}
                onChange={(event) => setFeatureExportSvg(event.target.checked)}
              />
              {tr(locale, "export svg", "导出 svg")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={featureExportPng}
                onChange={(event) => setFeatureExportPng(event.target.checked)}
              />
              {tr(locale, "export png", "导出 png")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={featureExportPdf}
                onChange={(event) => setFeatureExportPdf(event.target.checked)}
              />
              {tr(locale, "export pdf (beta)", "导出 pdf（beta）")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={featureImageToLatex}
                onChange={(event) => setFeatureImageToLatex(event.target.checked)}
              />
              {tr(locale, "image_to_latex action", "image_to_latex 动作")}
            </label>

            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="style-profile">{tr(locale, "Style Profile", "风格配置")}</Label>
              <Input
                id="style-profile"
                value={styleProfile}
                onChange={(event) => setStyleProfile(event.target.value)}
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="preferred-render-engine">{tr(locale, "Preferred Render Engine", "首选渲染引擎")}</Label>
              <select
                id="preferred-render-engine"
                className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                value={preferredRenderEngine}
                onChange={(event) =>
                  setPreferredRenderEngine(event.target.value as RenderEngine)
                }
              >
                <option value="katex">KaTeX</option>
                <option value="mathjax" disabled={!mathjaxCapability}>
                  {tr(locale, "MathJax (experimental)", "MathJax（实验）")}
                </option>
              </select>
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void saveConfig()} disabled={busySave}>
              {busySave ? tr(locale, "Saving...", "保存中...") : tr(locale, "Save & Apply", "保存并应用")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void testConnection()} disabled={busyTest}>
              {busyTest ? tr(locale, "Testing...", "测试中...") : tr(locale, "Test Connection", "测试连接")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void loadErrors()}>
              {tr(locale, "View Recent Errors", "查看最近错误")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void loadMetrics()} disabled={busyMetrics}>
              {busyMetrics ? tr(locale, "Loading Metrics...", "加载指标中...") : tr(locale, "View Usage Metrics", "查看使用指标")}
            </Button>
          </div>
          {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
          {testStatus ? <p className="text-sm text-sky-300">{testStatus}</p> : null}
        </Card>

        {metrics ? (
          <Card className="space-y-2">
            <CardTitle>{tr(locale, "Anonymous Usage Metrics", "匿名使用指标")}</CardTitle>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p>{tr(locale, "AI calls", "AI 调用次数")}: {metrics.ai_calls}</p>
              <p>{tr(locale, "SVG exports", "SVG 导出次数")}: {metrics.export_svg}</p>
              <p>{tr(locale, "PNG exports", "PNG 导出次数")}: {metrics.export_png}</p>
              <p>{tr(locale, "PDF exports", "PDF 导出次数")}: {metrics.export_pdf}</p>
              <p>{tr(locale, "Render failures", "渲染失败次数")}: {metrics.render_failure}</p>
              <p className="text-xs text-slate-400 md:col-span-2">
                {tr(locale, "Last updated", "最后更新")}: {metrics.updated_at}
              </p>
            </div>
          </Card>
        ) : null}

        {recentErrors.length > 0 ? (
          <Card className="space-y-3">
            <CardTitle>{tr(locale, "Recent Errors", "最近错误")}</CardTitle>
            <div className="space-y-2 text-xs">
              {recentErrors.map((entry) => (
                <div key={entry.id} className="rounded-md border border-slate-800 bg-slate-950/70 p-2">
                  <p className="text-slate-300">[{entry.timestamp}] {entry.scope}</p>
                  <p>{entry.message}</p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
