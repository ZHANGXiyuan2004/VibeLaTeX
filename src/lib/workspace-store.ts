import type {
  AppTheme,
  FormulaHistoryItem,
  LatexMode,
  MacroDefinition,
  RenderEngine,
  UiLocale,
} from "@/shared/types";

export const DRAFT_STORAGE_KEY = "vibelatex:draft:v1";
export const HISTORY_STORAGE_KEY = "vibelatex:history:v1";
export const MACRO_STORAGE_KEY = "vibelatex:macros:v1";
export const THEME_STORAGE_KEY = "vibelatex:theme:v1";
export const STYLE_PANEL_STORAGE_KEY = "vibelatex:style-panel:v1";
export const LOCALE_STORAGE_KEY = "vibelatex:locale:v1";

export const HISTORY_STORAGE_VERSION = 2;
export const DRAFT_STORAGE_VERSION = 1;
export const MACRO_STORAGE_VERSION = 1;
export const THEME_STORAGE_VERSION = 1;
export const STYLE_PANEL_STORAGE_VERSION = 1;
export const LOCALE_STORAGE_VERSION = 1;

export const MAX_RECENT_FORMULAS = 20;
export const MAX_HISTORY_TAGS = 8;

interface DraftRecordV1 {
  version: typeof DRAFT_STORAGE_VERSION;
  latex: string;
  mode: LatexMode;
  render_engine: RenderEngine;
  updated_at: string;
}

interface HistoryRecordV1 {
  version: 1;
  formulas: string[];
}

interface HistoryRecordV2 {
  version: typeof HISTORY_STORAGE_VERSION;
  items: FormulaHistoryItem[];
}

interface MacroRecordV1 {
  version: typeof MACRO_STORAGE_VERSION;
  macros: MacroDefinition[];
}

interface ThemeRecordV1 {
  version: typeof THEME_STORAGE_VERSION;
  theme: AppTheme;
}

interface StylePanelRecordV1 {
  version: typeof STYLE_PANEL_STORAGE_VERSION;
  collapsed: boolean;
}

interface LocaleRecordV1 {
  version: typeof LOCALE_STORAGE_VERSION;
  locale: UiLocale;
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeJsonParse(input: string | null): unknown {
  if (!input) {
    return null;
  }

  try {
    return JSON.parse(input) as unknown;
  } catch {
    return null;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeFormula(value: string): string {
  return value.trim();
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function normalizeTags(tags: string[]): string[] {
  const deduped: string[] = [];

  for (const rawTag of tags) {
    const tag = normalizeTag(rawTag);
    if (!tag || deduped.includes(tag)) {
      continue;
    }

    deduped.push(tag);
    if (deduped.length >= MAX_HISTORY_TAGS) {
      break;
    }
  }

  return deduped;
}

function normalizeMacroName(name: string): string {
  return name
    .trim()
    .replace(/^\\+/, "")
    .replace(/[^a-zA-Z@]+/g, "");
}

function normalizeMacroExpansion(expansion: string): string {
  return expansion.trim();
}

function isValidMode(input: unknown): input is LatexMode {
  return input === "inline" || input === "block";
}

function isValidRenderEngine(input: unknown): input is RenderEngine {
  return input === "katex" || input === "mathjax";
}

function isValidTheme(input: unknown): input is AppTheme {
  return input === "dark" || input === "light";
}

function isValidLocale(input: unknown): input is UiLocale {
  return input === "en" || input === "zh";
}

function isStylePanelRecord(raw: unknown): raw is StylePanelRecordV1 {
  if (!raw || typeof raw !== "object") {
    return false;
  }

  const data = raw as Partial<StylePanelRecordV1>;
  return data.version === STYLE_PANEL_STORAGE_VERSION && typeof data.collapsed === "boolean";
}

function toDraftRecord(raw: unknown): DraftRecordV1 | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Partial<DraftRecordV1>;
  if (data.version !== DRAFT_STORAGE_VERSION) {
    return null;
  }

  if (
    typeof data.latex !== "string" ||
    !isValidMode(data.mode) ||
    !isValidRenderEngine(data.render_engine) ||
    typeof data.updated_at !== "string"
  ) {
    return null;
  }

  return {
    version: DRAFT_STORAGE_VERSION,
    latex: data.latex,
    mode: data.mode,
    render_engine: data.render_engine,
    updated_at: data.updated_at,
  };
}

function buildHistoryItem(latex: string, base?: Partial<FormulaHistoryItem>): FormulaHistoryItem {
  const timestamp = nowIso();
  return {
    id: typeof base?.id === "string" && base.id ? base.id : createId(),
    latex: normalizeFormula(latex),
    starred: Boolean(base?.starred),
    tags: normalizeTags(Array.isArray(base?.tags) ? base.tags : []),
    created_at: typeof base?.created_at === "string" && base.created_at ? base.created_at : timestamp,
    updated_at: timestamp,
  };
}

function toHistoryItem(raw: unknown): FormulaHistoryItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Partial<FormulaHistoryItem>;
  if (typeof data.latex !== "string") {
    return null;
  }

  const latex = normalizeFormula(data.latex);
  if (!latex) {
    return null;
  }

  const timestamp = nowIso();
  return {
    id: typeof data.id === "string" && data.id ? data.id : createId(),
    latex,
    starred: Boolean(data.starred),
    tags: normalizeTags(Array.isArray(data.tags) ? data.tags : []),
    created_at: typeof data.created_at === "string" && data.created_at ? data.created_at : timestamp,
    updated_at: typeof data.updated_at === "string" && data.updated_at ? data.updated_at : timestamp,
  };
}

function toHistoryItems(raw: unknown): FormulaHistoryItem[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const maybeV2 = raw as Partial<HistoryRecordV2>;
  if (maybeV2.version === HISTORY_STORAGE_VERSION && Array.isArray(maybeV2.items)) {
    const cleaned = maybeV2.items
      .map((item) => toHistoryItem(item))
      .filter((item): item is FormulaHistoryItem => Boolean(item));
    return dedupeHistoryItems(cleaned);
  }

  const maybeV1 = raw as Partial<HistoryRecordV1>;
  if (maybeV1.version === 1 && Array.isArray(maybeV1.formulas)) {
    const migrated = maybeV1.formulas
      .filter((item): item is string => typeof item === "string")
      .map((item) => buildHistoryItem(item));
    return dedupeHistoryItems(migrated);
  }

  return [];
}

function dedupeHistoryItems(items: FormulaHistoryItem[]): FormulaHistoryItem[] {
  const deduped: FormulaHistoryItem[] = [];

  for (const item of items) {
    if (!item.latex || deduped.some((existing) => existing.latex === item.latex)) {
      continue;
    }

    deduped.push(item);
    if (deduped.length >= MAX_RECENT_FORMULAS) {
      break;
    }
  }

  return deduped;
}

function toMacro(raw: unknown): MacroDefinition | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Partial<MacroDefinition>;
  const name = normalizeMacroName(typeof data.name === "string" ? data.name : "");
  const expansion = normalizeMacroExpansion(typeof data.expansion === "string" ? data.expansion : "");

  if (!name || !expansion) {
    return null;
  }

  const timestamp = nowIso();
  return {
    id: typeof data.id === "string" && data.id ? data.id : createId(),
    name,
    expansion,
    enabled: data.enabled !== false,
    created_at: typeof data.created_at === "string" && data.created_at ? data.created_at : timestamp,
    updated_at: typeof data.updated_at === "string" && data.updated_at ? data.updated_at : timestamp,
  };
}

function toMacroRecord(raw: unknown): MacroRecordV1 | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Partial<MacroRecordV1>;
  if (data.version !== MACRO_STORAGE_VERSION || !Array.isArray(data.macros)) {
    return null;
  }

  const macros = data.macros
    .map((macro) => toMacro(macro))
    .filter((macro): macro is MacroDefinition => Boolean(macro));

  return {
    version: MACRO_STORAGE_VERSION,
    macros,
  };
}

export function loadDraft(): DraftRecordV1 | null {
  if (!hasStorage()) {
    return null;
  }

  const parsed = safeJsonParse(window.localStorage.getItem(DRAFT_STORAGE_KEY));
  return toDraftRecord(parsed);
}

export function saveDraft(input: {
  latex: string;
  mode: LatexMode;
  render_engine: RenderEngine;
}): void {
  if (!hasStorage()) {
    return;
  }

  const record: DraftRecordV1 = {
    version: DRAFT_STORAGE_VERSION,
    latex: input.latex,
    mode: input.mode,
    render_engine: input.render_engine,
    updated_at: nowIso(),
  };

  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(record));
}

export function loadRecentFormulas(): FormulaHistoryItem[] {
  if (!hasStorage()) {
    return [];
  }

  const parsed = safeJsonParse(window.localStorage.getItem(HISTORY_STORAGE_KEY));
  return toHistoryItems(parsed);
}

export function saveRecentFormulas(items: FormulaHistoryItem[]): void {
  if (!hasStorage()) {
    return;
  }

  const cleaned = dedupeHistoryItems(
    items
      .map((item) => toHistoryItem(item))
      .filter((item): item is FormulaHistoryItem => Boolean(item)),
  );

  const record: HistoryRecordV2 = {
    version: HISTORY_STORAGE_VERSION,
    items: cleaned,
  };

  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(record));
}

export function pushRecentFormula(formula: string, previous: FormulaHistoryItem[]): FormulaHistoryItem[] {
  const normalized = normalizeFormula(formula);
  if (!normalized) {
    return previous;
  }

  if (previous[0]?.latex === normalized) {
    return previous;
  }

  const existing = previous.find((item) => item.latex === normalized);
  const nextItem = existing
    ? {
        ...existing,
        updated_at: nowIso(),
      }
    : buildHistoryItem(normalized);

  return dedupeHistoryItems([
    nextItem,
    ...previous.filter((item) => item.latex !== normalized),
  ]);
}

export function toggleHistoryStar(itemId: string, previous: FormulaHistoryItem[]): FormulaHistoryItem[] {
  return previous.map((item) =>
    item.id === itemId
      ? {
          ...item,
          starred: !item.starred,
          updated_at: nowIso(),
        }
      : item,
  );
}

export function updateHistoryTags(
  itemId: string,
  nextTags: string[],
  previous: FormulaHistoryItem[],
): FormulaHistoryItem[] {
  return previous.map((item) =>
    item.id === itemId
      ? {
          ...item,
          tags: normalizeTags(nextTags),
          updated_at: nowIso(),
        }
      : item,
  );
}

export function listHistoryTags(items: FormulaHistoryItem[]): string[] {
  const tags = new Set<string>();

  for (const item of items) {
    for (const tag of item.tags) {
      tags.add(tag);
    }
  }

  return Array.from(tags).sort();
}

export function loadMacros(): MacroDefinition[] {
  if (!hasStorage()) {
    return [];
  }

  const parsed = safeJsonParse(window.localStorage.getItem(MACRO_STORAGE_KEY));
  return toMacroRecord(parsed)?.macros ?? [];
}

export function saveMacros(macros: MacroDefinition[]): void {
  if (!hasStorage()) {
    return;
  }

  const cleaned = macros
    .map((macro) => toMacro(macro))
    .filter((macro): macro is MacroDefinition => Boolean(macro));

  const record: MacroRecordV1 = {
    version: MACRO_STORAGE_VERSION,
    macros: cleaned,
  };

  window.localStorage.setItem(MACRO_STORAGE_KEY, JSON.stringify(record));
}

export function upsertMacro(
  macro: Pick<MacroDefinition, "name" | "expansion" | "enabled"> & { id?: string },
  previous: MacroDefinition[],
): MacroDefinition[] {
  const name = normalizeMacroName(macro.name);
  const expansion = normalizeMacroExpansion(macro.expansion);

  if (!name || !expansion) {
    return previous;
  }

  const existing = previous.find((item) => item.id === macro.id) ?? null;
  const record: MacroDefinition = {
    id: existing?.id ?? (macro.id && macro.id.trim() ? macro.id : createId()),
    name,
    expansion,
    enabled: macro.enabled,
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };

  const withoutCurrent = previous.filter((item) => item.id !== record.id);
  return [record, ...withoutCurrent.filter((item) => item.name !== record.name)];
}

export function removeMacro(macroId: string, previous: MacroDefinition[]): MacroDefinition[] {
  return previous.filter((item) => item.id !== macroId);
}

export function toggleMacroEnabled(macroId: string, previous: MacroDefinition[]): MacroDefinition[] {
  return previous.map((item) =>
    item.id === macroId
      ? {
          ...item,
          enabled: !item.enabled,
          updated_at: nowIso(),
        }
      : item,
  );
}

export function buildMacroMaps(macros: MacroDefinition[]): {
  katex: Record<string, string>;
  mathjax: Record<string, string>;
} {
  const katex: Record<string, string> = {};
  const mathjax: Record<string, string> = {};

  for (const macro of macros) {
    if (!macro.enabled) {
      continue;
    }

    const name = normalizeMacroName(macro.name);
    const expansion = normalizeMacroExpansion(macro.expansion);
    if (!name || !expansion) {
      continue;
    }

    katex[`\\${name}`] = expansion;
    mathjax[name] = expansion;
  }

  return { katex, mathjax };
}

export function loadThemePreference(): AppTheme {
  if (!hasStorage()) {
    return "dark";
  }

  const raw = safeJsonParse(window.localStorage.getItem(THEME_STORAGE_KEY));
  if (!raw || typeof raw !== "object") {
    return "dark";
  }

  const data = raw as Partial<ThemeRecordV1>;
  if (data.version !== THEME_STORAGE_VERSION || !isValidTheme(data.theme)) {
    return "dark";
  }

  return data.theme;
}

export function saveThemePreference(theme: AppTheme): void {
  if (!hasStorage()) {
    return;
  }

  const record: ThemeRecordV1 = {
    version: THEME_STORAGE_VERSION,
    theme,
  };

  window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(record));
}

export function loadStylePanelCollapsedPreference(): boolean {
  if (!hasStorage()) {
    return false;
  }

  const raw = safeJsonParse(window.localStorage.getItem(STYLE_PANEL_STORAGE_KEY));
  if (!isStylePanelRecord(raw)) {
    return false;
  }

  return raw.collapsed;
}

export function saveStylePanelCollapsedPreference(collapsed: boolean): void {
  if (!hasStorage()) {
    return;
  }

  const record: StylePanelRecordV1 = {
    version: STYLE_PANEL_STORAGE_VERSION,
    collapsed,
  };

  window.localStorage.setItem(STYLE_PANEL_STORAGE_KEY, JSON.stringify(record));
}

export function loadLocalePreference(): UiLocale {
  if (!hasStorage()) {
    return "en";
  }

  const raw = safeJsonParse(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  if (!raw || typeof raw !== "object") {
    return "en";
  }

  const data = raw as Partial<LocaleRecordV1>;
  if (data.version !== LOCALE_STORAGE_VERSION || !isValidLocale(data.locale)) {
    return "en";
  }

  return data.locale;
}

export function saveLocalePreference(locale: UiLocale): void {
  if (!hasStorage()) {
    return;
  }

  const record: LocaleRecordV1 = {
    version: LOCALE_STORAGE_VERSION,
    locale,
  };

  window.localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(record));
}

export function parseTagsInput(value: string): string[] {
  return normalizeTags(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}
