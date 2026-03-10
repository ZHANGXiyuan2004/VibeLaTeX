import type { UiLocale } from "@/shared/types";

export function tr(locale: UiLocale, en: string, zh: string): string {
  return locale === "zh" ? zh : en;
}

export function toggleLocale(locale: UiLocale): UiLocale {
  return locale === "zh" ? "en" : "zh";
}

export function isLocale(value: unknown): value is UiLocale {
  return value === "en" || value === "zh";
}
