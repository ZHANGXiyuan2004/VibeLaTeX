export type LatexMode = "inline" | "block";
export type ExportFormat = "svg" | "png";
export type ExportScale = 1 | 2 | 4;
export type ExportTrim = "tight" | "include_padding";
export type PdfPageSize = "A4" | "Letter";
export type PdfMarginPt = 12 | 24 | 36;
export type AlignMode = "left" | "center" | "right";
export type BackgroundMode = "transparent" | "solid";
export type RenderEngine = "katex" | "mathjax";
export type AppTheme = "dark" | "light";
export type UiLocale = "en" | "zh";

export type LlmAction =
  | "format_latex"
  | "fix_latex"
  | "refactor_latex"
  | "nl_to_latex"
  | "explain_latex"
  | "img_to_latex";

export interface Capabilities {
  vision: boolean;
  mathjax: boolean;
}

export interface FeaturesEnabled {
  ai: boolean;
  format: boolean;
  fix: boolean;
  refactor: boolean;
  nl_to_latex: boolean;
  explain: boolean;
  export_svg: boolean;
  export_png: boolean;
  export_pdf: boolean;
  image_to_latex: boolean;
}

export interface DefaultExportOptions {
  format: ExportFormat;
  scale: ExportScale;
  padding: number;
  background_mode: BackgroundMode;
  background_color: string;
  trim: ExportTrim;
}

export interface ProviderConfig {
  base_url: string;
  api_key: string;
  model: string;
  timeout: number;
  retry_attempts: number;
  retry_backoff_ms: number;
  headers: Record<string, string>;
}

export interface StyleRules {
  enforce_katex_compatible: boolean;
  style_profile: string;
  preferred_render_engine: RenderEngine;
}

export interface MacroDefinition {
  id: string;
  name: string;
  expansion: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormulaHistoryItem {
  id: string;
  latex: string;
  starred: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface AppConfig {
  provider: ProviderConfig;
  capabilities: Capabilities;
  features_enabled: FeaturesEnabled;
  default_export_options: DefaultExportOptions;
  style_rules: StyleRules;
}

export interface PublicConfig {
  capabilities: Capabilities;
  features_enabled: FeaturesEnabled;
  default_export_options: DefaultExportOptions;
  style_rules: {
    preferred_render_engine: RenderEngine;
  };
  security: {
    admin_protected: boolean;
  };
}

export interface LlmActionRequest {
  action: LlmAction;
  latex?: string;
  error_message?: string;
  instruction?: string;
  constraints?: Record<string, unknown>;
  image?: string;
}

export interface LlmActionResponse {
  ok: boolean;
  latex: string;
  changes?: string[];
  explanation?: string;
  reasoning?: string;
  meta?: Record<string, unknown>;
  raw?: unknown;
  error?: string;
}

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  scope: string;
  message: string;
  detail?: unknown;
}

export type MetricEvent = "ai_call" | "export_svg" | "export_png" | "export_pdf" | "render_failure";

export interface MetricsSnapshot {
  version: 1;
  ai_calls: number;
  export_svg: number;
  export_png: number;
  export_pdf: number;
  render_failure: number;
  updated_at: string;
}

export interface PdfExportOptions {
  page_size: PdfPageSize;
  margin_pt: PdfMarginPt;
  background_mode: BackgroundMode;
}

export interface PreviewStyleState {
  font_size: number;
  text_color: string;
  background_mode: BackgroundMode;
  background_color: string;
  padding: number;
  align: AlignMode;
  render_engine: RenderEngine;
  preview_scale: number;
  export_scale: ExportScale;
  trim: ExportTrim;
}

export const MAX_PADDING = 64;
export const DEFAULT_LATEX = String.raw`\begin{aligned}
  f(x) &= x^2 + 2x + 1 \\
       &= (x+1)^2
\end{aligned}`;
