"use client";

import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import type * as Monaco from "monaco-editor";

import { ResizablePanelGrip } from "@/components/ui/resizable-panel-grip";
import { tr } from "@/lib/i18n";
import type { AppTheme } from "@/shared/types";
import type { LatexMode } from "@/shared/types";
import type { UiLocale } from "@/shared/types";

interface EditorPaneProps {
  locale: UiLocale;
  value: string;
  mode: LatexMode;
  theme: AppTheme;
  errorPosition: number | null;
  errorMessage: string | null;
  errorLine: number | null;
  errorColumn: number | null;
  focusSignal: number;
  onForceRender: () => void;
  onExportDefault: () => void;
  onChange: (nextValue: string) => void;
}

let latexLanguageRegistered = false;

function registerLatexLanguage(monaco: typeof Monaco): void {
  if (latexLanguageRegistered) {
    return;
  }

  monaco.languages.register({ id: "vibelatex" });
  monaco.languages.setMonarchTokensProvider("vibelatex", {
    tokenizer: {
      root: [
        [/\\[a-zA-Z@]+/, "keyword"],
        [/\\./, "keyword"],
        [/%.*$/, "comment"],
        [/\$+/, "delimiter"],
        [/[{}[\]()]/, "delimiter.bracket"],
        [/[&_^]/, "operator"],
        [/\d+(\.\d+)?/, "number"],
        [/[^\\%${}\[\]()&_^0-9\s]+/, "identifier"],
        [/\s+/, "white"],
      ],
    },
  });

  monaco.editor.defineTheme("vibelatex-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "60a5fa" },
      { token: "comment", foreground: "64748b", fontStyle: "italic" },
      { token: "delimiter", foreground: "f59e0b" },
      { token: "delimiter.bracket", foreground: "a78bfa" },
      { token: "operator", foreground: "f472b6" },
      { token: "number", foreground: "22d3ee" },
      { token: "identifier", foreground: "e2e8f0" },
    ],
    colors: {
      "editor.background": "#020617",
      "editorLineNumber.foreground": "#64748b",
      "editorLineNumber.activeForeground": "#cbd5e1",
      "editorCursor.foreground": "#34d399",
      "editor.selectionBackground": "#1e293b",
      "editor.inactiveSelectionBackground": "#1e293b99",
    },
  });

  monaco.editor.defineTheme("vibelatex-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "2563eb" },
      { token: "comment", foreground: "64748b", fontStyle: "italic" },
      { token: "delimiter", foreground: "b45309" },
      { token: "delimiter.bracket", foreground: "7c3aed" },
      { token: "operator", foreground: "be185d" },
      { token: "number", foreground: "0e7490" },
      { token: "identifier", foreground: "0f172a" },
    ],
    colors: {
      "editor.background": "#f8fafc",
      "editorLineNumber.foreground": "#94a3b8",
      "editorLineNumber.activeForeground": "#334155",
      "editorCursor.foreground": "#059669",
      "editor.selectionBackground": "#dbeafe",
      "editor.inactiveSelectionBackground": "#dbeafe80",
    },
  });

  latexLanguageRegistered = true;
}

export function EditorPane({
  locale,
  value,
  mode,
  theme,
  errorPosition,
  errorMessage,
  errorLine,
  errorColumn,
  focusSignal,
  onForceRender,
  onExportDefault,
  onChange,
}: EditorPaneProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const decorationIdsRef = useRef<string[]>([]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerLatexLanguage(monaco);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onForceRender();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onExportDefault();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
      editor.focus();
    });
  };

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor) {
      return;
    }

    const model = editor.getModel();
    if (!model || !errorPosition || !monaco) {
      decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
      if (model && monaco) {
        monaco.editor.setModelMarkers(model, "vibelatex", []);
      }
      return;
    }

    const safeStartOffset = Math.max(0, errorPosition - 1);
    const safeEndOffset = Math.min(model.getValueLength(), safeStartOffset + 1);
    const start = model.getPositionAt(safeStartOffset);
    const end = model.getPositionAt(safeEndOffset);

    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, [
      {
        range: {
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column,
        },
        options: {
          inlineClassName: "latex-error-decoration",
          glyphMarginClassName: "latex-error-glyph",
          hoverMessage: {
            value: errorMessage ?? "Potential render error location",
          },
        },
      },
    ]);

    monaco.editor.setModelMarkers(model, "vibelatex", [
      {
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: Math.max(end.column, start.column + 1),
        message: errorMessage ?? "Potential render error location",
        severity: monaco.MarkerSeverity.Error,
      },
    ]);

    editor.revealPositionInCenter({
      lineNumber: start.lineNumber,
      column: start.column,
    });
  }, [errorMessage, errorPosition]);

  useEffect(() => {
    editorRef.current?.focus();
  }, [focusSignal]);

  return (
    <div
      data-resizable-panel="true"
      className="resizable-panel flex h-[240px] min-h-[240px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 shadow-inner shadow-black/30"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2 text-xs text-slate-400">
        <span>
          {tr(locale, "Editor", "编辑器")} ({mode === "block" ? tr(locale, "Display", "块级") : tr(locale, "Inline", "行内")} {tr(locale, "mode", "模式")})
        </span>
        <span>⌘/Ctrl+Enter refresh · ⌘/Ctrl+S export · ⌘/Ctrl+L focus</span>
      </div>
      {errorMessage ? (
        <div className="border-b border-rose-500/30 bg-rose-950/30 px-3 py-1.5 text-[11px] text-rose-200">
          {tr(locale, "Error", "错误")}{errorLine && errorColumn ? ` @ L${errorLine}:C${errorColumn}` : ""}: {errorMessage}
        </div>
      ) : null}
      {!errorMessage ? (
        <div className="border-b border-slate-800 px-3 py-1.5 text-[11px] text-slate-500">
          {tr(locale, "No current render errors", "当前无渲染错误")}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 pr-3 pb-3">
        <Editor
          height="100%"
          defaultLanguage="vibelatex"
          theme={theme === "dark" ? "vibelatex-dark" : "vibelatex-light"}
          value={value}
          onMount={onMount}
          onChange={(next) => onChange(next ?? "")}
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            lineNumbers: "on",
            wordWrap: "on",
            fontSize: 14,
            smoothScrolling: true,
            scrollBeyondLastLine: false,
            glyphMargin: true,
            bracketPairColorization: { enabled: true },
            quickSuggestions: true,
            tabSize: 2,
          }}
        />
      </div>
      <ResizablePanelGrip />
    </div>
  );
}
