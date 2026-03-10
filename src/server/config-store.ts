import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type { AppConfig, PublicConfig } from "@/shared/types";
import { logError } from "@/server/error-log";

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const providerSchema = z.object({
  base_url: z.string().min(1),
  api_key: z.string(),
  model: z.string().min(1),
  timeout: z.number().int().positive(),
  retry_attempts: z.number().int().min(0).max(1),
  retry_backoff_ms: z.number().int().positive().max(30_000),
  headers: z.record(z.string(), z.string()),
});

const capabilitiesSchema = z.object({
  vision: z.boolean(),
  mathjax: z.boolean(),
});

const featuresSchema = z.object({
  ai: z.boolean(),
  format: z.boolean(),
  fix: z.boolean(),
  refactor: z.boolean(),
  nl_to_latex: z.boolean(),
  explain: z.boolean(),
  export_svg: z.boolean(),
  export_png: z.boolean(),
  export_pdf: z.boolean(),
  image_to_latex: z.boolean(),
});

const exportSchema = z.object({
  format: z.enum(["svg", "png"]),
  scale: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  padding: z.number().int().min(0).max(64),
  background_mode: z.enum(["transparent", "solid"]),
  background_color: z.string().min(1),
  trim: z.enum(["tight", "include_padding"]),
});

const styleSchema = z.object({
  enforce_katex_compatible: z.boolean(),
  style_profile: z.string().min(1),
  preferred_render_engine: z.enum(["katex", "mathjax"]),
});

const appConfigSchema = z.object({
  provider: providerSchema,
  capabilities: capabilitiesSchema,
  features_enabled: featuresSchema,
  default_export_options: exportSchema,
  style_rules: styleSchema,
});

export const DEFAULT_APP_CONFIG: AppConfig = {
  provider: {
    base_url: "https://api.openai.com/v1",
    api_key: "",
    model: "gpt-4.1-mini",
    timeout: 30_000,
    retry_attempts: 1,
    retry_backoff_ms: 400,
    headers: {},
  },
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
    enforce_katex_compatible: true,
    style_profile: "paper",
    preferred_render_engine: "katex",
  },
};

function deepMerge<T extends Record<string, unknown>>(base: T, patch: DeepPartial<T>): T {
  const output: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }

    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof output[key] === "object" &&
      output[key] !== null &&
      !Array.isArray(output[key])
    ) {
      output[key] = deepMerge(
        output[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
      continue;
    }

    output[key] = value;
  }

  return output as T;
}

export function getConfigPath(): string {
  const override = process.env.VIBELATEX_CONFIG_PATH?.trim();
  if (override) {
    return override;
  }
  return path.join(process.cwd(), ".data", "config.json");
}

async function ensureConfigFile(): Promise<void> {
  const configPath = getConfigPath();
  await mkdir(path.dirname(configPath), { recursive: true });

  try {
    await readFile(configPath, "utf8");
  } catch {
    await writeFile(configPath, JSON.stringify(DEFAULT_APP_CONFIG, null, 2), "utf8");
  }
}

function normalizeRetryAttempts(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_APP_CONFIG.provider.retry_attempts;
  }

  return Math.max(0, Math.min(1, Math.trunc(value)));
}

function validateConfig(input: unknown): AppConfig {
  const merged = deepMerge(
    DEFAULT_APP_CONFIG as unknown as Record<string, unknown>,
    (input ?? {}) as Record<string, unknown>,
  );

  const provider =
    typeof merged.provider === "object" && merged.provider !== null
      ? (merged.provider as Record<string, unknown>)
      : {};

  return appConfigSchema.parse({
    ...merged,
    provider: {
      ...provider,
      retry_attempts: normalizeRetryAttempts(provider.retry_attempts),
    },
  });
}

export async function getConfig(): Promise<AppConfig> {
  const configPath = getConfigPath();

  try {
    await ensureConfigFile();
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return validateConfig(parsed);
  } catch (error) {
    logError("config-store", "Failed to load config, fallback to defaults.", {
      error: error instanceof Error ? error.message : String(error),
      configPath,
    });
    return structuredClone(DEFAULT_APP_CONFIG);
  }
}

export async function saveConfig(patch: DeepPartial<AppConfig>): Promise<AppConfig> {
  const current = await getConfig();
  const merged = deepMerge(current as unknown as Record<string, unknown>, patch as Record<string, unknown>);

  const validated = validateConfig(merged);
  const configPath = getConfigPath();

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(validated, null, 2), "utf8");

  return validated;
}

export function toPublicConfig(config: AppConfig): PublicConfig {
  return {
    capabilities: config.capabilities,
    features_enabled: config.features_enabled,
    default_export_options: config.default_export_options,
    style_rules: {
      preferred_render_engine: config.style_rules.preferred_render_engine,
    },
    security: {
      admin_protected: Boolean(process.env.ADMIN_PASSWORD?.trim()),
    },
  };
}
