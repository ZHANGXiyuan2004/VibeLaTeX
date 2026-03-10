"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { tr, toggleLocale } from "@/lib/i18n";
import { loadLocalePreference, loadThemePreference, saveLocalePreference } from "@/lib/workspace-store";
import type { AppTheme, UiLocale } from "@/shared/types";

function resolveThemePreference(): AppTheme {
  if (typeof document !== "undefined") {
    const documentTheme = document.documentElement.dataset.theme;
    if (documentTheme === "dark" || documentTheme === "light") {
      return documentTheme;
    }
  }

  return loadThemePreference();
}

export function AdminLogin() {
  const [locale, setLocale] = useState<UiLocale>("en");
  const [localeReady, setLocaleReady] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const preferredTheme = resolveThemePreference();
    document.documentElement.dataset.theme = preferredTheme;
    setLocale(loadLocalePreference());
    setLocaleReady(true);
  }, []);

  useEffect(() => {
    if (!localeReady) {
      return;
    }
    saveLocalePreference(locale);
  }, [locale, localeReady]);

  const submit = async () => {
    setPending(true);
    setStatus("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setStatus(data.error ?? tr(locale, "Login failed.", "登录失败。"));
        return;
      }

      window.location.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : tr(locale, "Login failed.", "登录失败。"));
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="admin-login-bg flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md space-y-4">
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => setLocale((previous) => toggleLocale(previous))}>
            <Languages className="mr-1 h-3.5 w-3.5" />
            {locale === "en" ? "中文" : "EN"}
          </Button>
        </div>
        <div>
          <CardTitle>{tr(locale, "Admin Authentication", "管理员认证")}</CardTitle>
          <CardDescription>{tr(locale, "Enter ADMIN_PASSWORD to access configuration.", "输入 ADMIN_PASSWORD 以访问配置页面。")}</CardDescription>
        </div>

        <Input
          type="password"
          placeholder={tr(locale, "Password", "密码")}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void submit();
            }
          }}
        />

        {status ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-950/40 px-2 py-1 text-xs text-rose-200">
            {status}
          </p>
        ) : null}

        <Button type="button" onClick={() => void submit()} disabled={pending}>
          {pending ? tr(locale, "Verifying...", "验证中...") : tr(locale, "Login", "登录")}
        </Button>
      </Card>
    </main>
  );
}
