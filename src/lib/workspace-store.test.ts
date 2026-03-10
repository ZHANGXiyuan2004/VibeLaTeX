// @vitest-environment jsdom

import {
  DRAFT_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  LOCALE_STORAGE_KEY,
  MACRO_STORAGE_KEY,
  MAX_RECENT_FORMULAS,
  STYLE_PANEL_STORAGE_KEY,
  THEME_STORAGE_KEY,
  buildMacroMaps,
  loadDraft,
  loadMacros,
  loadLocalePreference,
  loadRecentFormulas,
  loadStylePanelCollapsedPreference,
  loadThemePreference,
  parseTagsInput,
  pushRecentFormula,
  removeMacro,
  saveDraft,
  saveMacros,
  saveLocalePreference,
  saveRecentFormulas,
  saveStylePanelCollapsedPreference,
  saveThemePreference,
  toggleHistoryStar,
  toggleMacroEnabled,
  updateHistoryTags,
  upsertMacro,
} from "@/lib/workspace-store";

describe("workspace-store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("persists and restores draft content with versioned schema", () => {
    saveDraft({
      latex: "x^2 + y^2",
      mode: "block",
      render_engine: "katex",
    });

    const restored = loadDraft();
    expect(restored?.latex).toBe("x^2 + y^2");
    expect(restored?.mode).toBe("block");
    expect(restored?.render_engine).toBe("katex");
    expect(restored?.updated_at).toBeTruthy();
  });

  it("ignores incompatible draft schema", () => {
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: 999,
        latex: "x",
      }),
    );

    expect(loadDraft()).toBeNull();
  });

  it("migrates v1 history payload to structured records", () => {
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        formulas: ["x+y", "\\frac{1}{2}"],
      }),
    );

    const restored = loadRecentFormulas();
    expect(restored).toHaveLength(2);
    expect(restored[0]?.latex).toBe("x+y");
    expect(restored[0]?.starred).toBe(false);
    expect(restored[0]?.tags).toEqual([]);
  });

  it("stores recent formulas with dedupe and max length", () => {
    const formulas = Array.from({ length: MAX_RECENT_FORMULAS + 4 }, (_, index) => ({
      id: `id-${index}`,
      latex: `x_${index}`,
      starred: false,
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    saveRecentFormulas([
      {
        id: "id-a",
        latex: "x_0",
        starred: false,
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "id-b",
        latex: "x_1",
        starred: false,
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      ...formulas,
    ]);

    const restored = loadRecentFormulas();
    expect(restored.length).toBe(MAX_RECENT_FORMULAS);
    expect(restored[0]?.latex).toBe("x_0");
    expect(restored[1]?.latex).toBe("x_1");
  });

  it("pushes new formula to the front and removes duplicates", () => {
    const initial = [
      {
        id: "1",
        latex: "x+y",
        starred: false,
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "2",
        latex: "a+b",
        starred: true,
        tags: ["favorite"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const updated = pushRecentFormula("a+b", initial);
    expect(updated[0]?.latex).toBe("a+b");
    expect(updated[0]?.starred).toBe(true);
    expect(updated[1]?.latex).toBe("x+y");
  });

  it("updates star and tags", () => {
    const [entry] = pushRecentFormula("x+y", []);
    const starred = toggleHistoryStar(entry.id, [entry]);
    expect(starred[0]?.starred).toBe(true);

    const tagged = updateHistoryTags(entry.id, parseTagsInput("algebra, matrix"), starred);
    expect(tagged[0]?.tags).toEqual(["algebra", "matrix"]);
  });

  it("handles macro persistence and map building", () => {
    const initial = upsertMacro(
      {
        name: "\\RR",
        expansion: "\\mathbb{R}",
        enabled: true,
      },
      [],
    );

    const toggled = toggleMacroEnabled(initial[0]?.id ?? "", initial);
    const removed = removeMacro(initial[0]?.id ?? "", toggled);

    saveMacros(initial);
    const restored = loadMacros();
    expect(restored[0]?.name).toBe("RR");

    const maps = buildMacroMaps(restored);
    expect(maps.katex["\\RR"]).toBe("\\mathbb{R}");
    expect(maps.mathjax.RR).toBe("\\mathbb{R}");

    expect(removed).toEqual([]);
  });

  it("stores theme preference", () => {
    saveThemePreference("light");
    expect(loadThemePreference()).toBe("light");

    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ version: 999, theme: "dark" }));
    expect(loadThemePreference()).toBe("dark");
  });

  it("returns empty list for invalid macro payload", () => {
    window.localStorage.setItem(MACRO_STORAGE_KEY, JSON.stringify({ version: 1, macros: "bad" }));
    expect(loadMacros()).toEqual([]);
  });

  it("stores settings panel collapsed preference", () => {
    expect(loadStylePanelCollapsedPreference()).toBe(false);

    saveStylePanelCollapsedPreference(true);
    expect(loadStylePanelCollapsedPreference()).toBe(true);

    window.localStorage.setItem(
      STYLE_PANEL_STORAGE_KEY,
      JSON.stringify({ version: 999, collapsed: false }),
    );
    expect(loadStylePanelCollapsedPreference()).toBe(false);
  });

  it("stores locale preference", () => {
    expect(loadLocalePreference()).toBe("en");

    saveLocalePreference("zh");
    expect(loadLocalePreference()).toBe("zh");

    window.localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify({ version: 999, locale: "en" }));
    expect(loadLocalePreference()).toBe("en");
  });
});
