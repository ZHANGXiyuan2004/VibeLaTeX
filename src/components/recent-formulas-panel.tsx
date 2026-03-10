"use client";

import { useMemo, useState } from "react";
import { Clock3, Eraser, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResizablePanelGrip } from "@/components/ui/resizable-panel-grip";
import { tr } from "@/lib/i18n";
import type { FormulaHistoryItem, UiLocale } from "@/shared/types";

interface RecentFormulasPanelProps {
  locale: UiLocale;
  history: FormulaHistoryItem[];
  activeTag: string | null;
  onUseHistory: (latex: string) => void;
  onClearHistory: () => void;
  onToggleStar: (id: string) => void;
  onUpdateTags: (id: string, tagsInput: string) => void;
  onSetActiveTag: (tag: string | null) => void;
}

interface HistoryItemRowProps {
  locale: UiLocale;
  item: FormulaHistoryItem;
  onUseHistory: (latex: string) => void;
  onToggleStar: (id: string) => void;
  onUpdateTags: (id: string, tagsInput: string) => void;
}

function compactFormula(latex: string): string {
  return latex.replace(/\s+/g, " ").trim();
}

function HistoryItemRow({ locale, item, onUseHistory, onToggleStar, onUpdateTags }: HistoryItemRowProps) {
  const [tagsInput, setTagsInput] = useState(() => item.tags.join(", "));

  return (
    <div className="space-y-2 rounded-md border border-slate-800 bg-slate-950/70 px-2 py-2">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 text-left text-xs text-slate-300 transition-colors hover:text-slate-100"
          onClick={() => onUseHistory(item.latex)}
          title={item.latex}
        >
          {compactFormula(item.latex)}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onToggleStar(item.id)}
          title={item.starred ? tr(locale, "Unstar", "取消星标") : tr(locale, "Star", "星标")}
          aria-label={item.starred ? tr(locale, "Unstar formula", "取消公式星标") : tr(locale, "Star formula", "标记公式为星标")}
        >
          <Star className={`h-3.5 w-3.5 ${item.starred ? "fill-current text-amber-300" : "text-slate-500"}`} />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
        {item.tags.length === 0 ? <span>{tr(locale, "No tags", "无标签")}</span> : item.tags.map((tag) => <span key={tag}>#{tag}</span>)}
      </div>

      <Input
        value={tagsInput}
        onChange={(event) => setTagsInput(event.target.value)}
        onBlur={() => onUpdateTags(item.id, tagsInput)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onUpdateTags(item.id, tagsInput);
          }
        }}
        className="h-8 text-xs"
        placeholder={tr(locale, "tags: algebra, matrix", "标签：代数, 矩阵")}
        aria-label={tr(locale, "Edit tags", "编辑标签")}
      />
    </div>
  );
}

export function RecentFormulasPanel({
  locale,
  history,
  activeTag,
  onUseHistory,
  onClearHistory,
  onToggleStar,
  onUpdateTags,
  onSetActiveTag,
}: RecentFormulasPanelProps) {
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const item of history) {
      for (const tag of item.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort();
  }, [history]);

  const filtered = useMemo(
    () => (activeTag ? history.filter((item) => item.tags.includes(activeTag)) : history),
    [activeTag, history],
  );

  return (
    <Card
      data-resizable-panel="true"
      className="resizable-panel flex h-[240px] min-h-[240px] flex-col overflow-hidden"
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-2 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              {tr(locale, "Recent formulas", "最近公式")}
            </CardTitle>
            <CardDescription>{tr(locale, "Last 20 formulas with stars and tags", "最近 20 条公式（含星标与标签）")}</CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClearHistory}>
            <Eraser className="mr-1 h-3.5 w-3.5" />
            {tr(locale, "Clear", "清空")}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant={activeTag === null ? "secondary" : "ghost"}
            onClick={() => onSetActiveTag(null)}
          >
            {tr(locale, "All", "全部")}
          </Button>
          {allTags.map((tag) => (
            <Button
              key={tag}
              type="button"
              size="sm"
              variant={activeTag === tag ? "secondary" : "ghost"}
              onClick={() => onSetActiveTag(tag)}
            >
              #{tag}
            </Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-700/70 px-3 py-3 text-xs text-slate-500">
            {history.length === 0
              ? tr(locale, "No recent formulas yet.", "还没有最近公式。")
              : tr(locale, "No formulas match current tag filter.", "没有符合当前标签筛选的公式。")}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.slice(0, 12).map((item) => (
              <HistoryItemRow
                key={`${item.id}-${item.updated_at}`}
                locale={locale}
                item={item}
                onUseHistory={onUseHistory}
                onToggleStar={onToggleStar}
                onUpdateTags={onUpdateTags}
              />
            ))}
          </div>
        )}
      </div>
      <ResizablePanelGrip />
    </Card>
  );
}
