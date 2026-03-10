"use client";

import { useMemo, useState } from "react";
import { Code2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResizablePanelGrip } from "@/components/ui/resizable-panel-grip";
import { Textarea } from "@/components/ui/textarea";
import { tr } from "@/lib/i18n";
import type { MacroDefinition, UiLocale } from "@/shared/types";

interface MacroPanelProps {
  locale: UiLocale;
  macros: MacroDefinition[];
  onAddMacro: (name: string, expansion: string) => void;
  onUpdateMacro: (macro: Pick<MacroDefinition, "id" | "name" | "expansion" | "enabled">) => void;
  onToggleMacro: (id: string) => void;
  onDeleteMacro: (id: string) => void;
}

interface MacroRowProps {
  locale: UiLocale;
  macro: MacroDefinition;
  onUpdateMacro: (macro: Pick<MacroDefinition, "id" | "name" | "expansion" | "enabled">) => void;
  onToggleMacro: (id: string) => void;
  onDeleteMacro: (id: string) => void;
}

function normalizeMacroCommand(input: string): string {
  return input.trim().replace(/^\\+/, "");
}

function MacroRow({ locale, macro, onUpdateMacro, onToggleMacro, onDeleteMacro }: MacroRowProps) {
  const [name, setName] = useState(() => `\\${macro.name}`);
  const [expansion, setExpansion] = useState(() => macro.expansion);

  const dirty = useMemo(
    () => normalizeMacroCommand(name) !== macro.name || expansion.trim() !== macro.expansion,
    [expansion, macro.expansion, macro.name, name],
  );

  const canSave = normalizeMacroCommand(name).length > 0 && expansion.trim().length > 0;

  return (
    <div className="space-y-2 rounded-lg border border-slate-800/80 bg-slate-950/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={macro.enabled}
            onChange={() => onToggleMacro(macro.id)}
          />
          {tr(locale, "Enabled", "启用")}
        </label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!dirty || !canSave}
            onClick={() =>
              onUpdateMacro({
                id: macro.id,
                name,
                expansion,
                enabled: macro.enabled,
              })
            }
          >
            {tr(locale, "Save", "保存")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onDeleteMacro(macro.id)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            {tr(locale, "Delete", "删除")}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[0.7fr_1.3fr]">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="\\RR"
          aria-label="Macro name"
        />
        <Textarea
          value={expansion}
          onChange={(event) => setExpansion(event.target.value)}
          placeholder="\\mathbb{R}"
          className="min-h-14"
          aria-label="Macro expansion"
        />
      </div>
    </div>
  );
}

export function MacroPanel({
  locale,
  macros,
  onAddMacro,
  onUpdateMacro,
  onToggleMacro,
  onDeleteMacro,
}: MacroPanelProps) {
  const [name, setName] = useState("\\RR");
  const [expansion, setExpansion] = useState("\\mathbb{R}");

  const canAdd = normalizeMacroCommand(name).length > 0 && expansion.trim().length > 0;

  return (
    <Card
      data-resizable-panel="true"
      className="resizable-panel flex h-[220px] min-h-[220px] flex-col overflow-hidden"
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            {tr(locale, "Macros", "宏命令")}
          </CardTitle>
          <CardDescription>
            {tr(
              locale,
              "Manage custom commands shared by KaTeX and MathJax.",
              "管理 KaTeX 与 MathJax 共用的自定义命令。",
            )}
          </CardDescription>
        </div>

        <div className="grid gap-2 md:grid-cols-[0.7fr_1.3fr_auto] md:items-start">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="\\RR"
            aria-label="New macro name"
          />
          <Textarea
            value={expansion}
            onChange={(event) => setExpansion(event.target.value)}
            placeholder="\\mathbb{R}"
            className="min-h-14"
            aria-label="New macro expansion"
          />
          <Button
            type="button"
            size="sm"
            className="md:self-center"
            disabled={!canAdd}
            onClick={() => {
              onAddMacro(name, expansion);
              setName("\\");
              setExpansion("");
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {tr(locale, "Add", "添加")}
          </Button>
        </div>

        {macros.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-700/70 px-3 py-3 text-xs text-slate-500">
            {tr(locale, "No macros yet. Add one like ", "还没有宏命令。可先添加如 ")}
            <code>\\RR</code> → <code>\\mathbb{'{'}R{'}'}</code>.
          </div>
        ) : (
          <div className="space-y-2">
            {macros.map((macro) => (
              <MacroRow
                key={`${macro.id}-${macro.updated_at}`}
                locale={locale}
                macro={macro}
                onUpdateMacro={onUpdateMacro}
                onToggleMacro={onToggleMacro}
                onDeleteMacro={onDeleteMacro}
              />
            ))}
          </div>
        )}
      </div>
      <ResizablePanelGrip />
    </Card>
  );
}
