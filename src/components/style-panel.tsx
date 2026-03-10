"use client";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResizablePanelGrip } from "@/components/ui/resizable-panel-grip";
import { tr } from "@/lib/i18n";
import type { PreviewStyleState, UiLocale } from "@/shared/types";

interface StylePanelProps {
  locale: UiLocale;
  value: PreviewStyleState;
  mathJaxEnabled: boolean;
  onChange: (next: PreviewStyleState) => void;
}

export function StylePanel({ locale, value, mathJaxEnabled, onChange }: StylePanelProps) {
  const update = <K extends keyof PreviewStyleState>(key: K, nextValue: PreviewStyleState[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <Card
      data-resizable-panel="true"
      className="resizable-panel flex h-[260px] min-h-[260px] flex-col overflow-hidden"
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-2 pb-3">
      <div>
        <CardTitle>{tr(locale, "Style", "样式")}</CardTitle>
        <CardDescription>{tr(locale, "Preview style and export parameters", "预览样式与导出参数")}</CardDescription>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="render-engine">{tr(locale, "Render Engine", "渲染引擎")}</Label>
          <select
            id="render-engine"
            className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            value={value.render_engine}
            onChange={(event) =>
              update("render_engine", event.target.value as PreviewStyleState["render_engine"])
            }
          >
            <option value="katex">KaTeX (default)</option>
            <option value="mathjax" disabled={!mathJaxEnabled}>
              MathJax (experimental)
            </option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="font-size">{tr(locale, "Font Size", "字号")}</Label>
          <Input
            id="font-size"
            type="number"
            min={10}
            max={96}
            value={value.font_size}
            onChange={(event) => update("font_size", Number(event.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="text-color">{tr(locale, "Text Color", "文字颜色")}</Label>
          <Input
            id="text-color"
            type="color"
            value={value.text_color}
            onChange={(event) => update("text_color", event.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="padding">{tr(locale, "Padding", "内边距")}</Label>
          <Input
            id="padding"
            type="number"
            min={0}
            max={64}
            value={value.padding}
            onChange={(event) => update("padding", Number(event.target.value))}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="align">{tr(locale, "Align", "对齐")}</Label>
          <select
            id="align"
            className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            value={value.align}
            onChange={(event) => update("align", event.target.value as PreviewStyleState["align"])}
          >
            <option value="left">{tr(locale, "Left", "左对齐")}</option>
            <option value="center">{tr(locale, "Center", "居中")}</option>
            <option value="right">{tr(locale, "Right", "右对齐")}</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="background-mode">{tr(locale, "Background", "背景")}</Label>
          <select
            id="background-mode"
            className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            value={value.background_mode}
            onChange={(event) =>
              update("background_mode", event.target.value as PreviewStyleState["background_mode"])
            }
          >
            <option value="transparent">{tr(locale, "Transparent", "透明")}</option>
            <option value="solid">{tr(locale, "Solid", "纯色")}</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="background-color">{tr(locale, "BG Color", "背景色")}</Label>
          <Input
            id="background-color"
            type="color"
            value={value.background_color}
            onChange={(event) => update("background_color", event.target.value)}
            disabled={value.background_mode === "transparent"}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="preview-scale">{tr(locale, "Preview Scale", "预览缩放")}</Label>
          <select
            id="preview-scale"
            className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            value={value.preview_scale}
            onChange={(event) => update("preview_scale", Number(event.target.value))}
          >
            <option value={0.75}>0.75x</option>
            <option value={1}>1x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="export-scale">{tr(locale, "Export Scale", "导出缩放")}</Label>
          <select
            id="export-scale"
            className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            value={value.export_scale}
            onChange={(event) => update("export_scale", Number(event.target.value) as 1 | 2 | 4)}
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </div>
      </div>

      {!mathJaxEnabled ? (
        <p className="text-xs text-amber-300">
          {tr(
            locale,
            "MathJax is disabled in admin capabilities. Enable it in /admin to switch engines.",
            "MathJax 在管理端能力中已禁用。请在 /admin 启用后再切换引擎。",
          )}
        </p>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="trim">{tr(locale, "Export Crop", "导出裁剪")}</Label>
        <select
          id="trim"
          className="h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          value={value.trim}
          onChange={(event) => update("trim", event.target.value as PreviewStyleState["trim"])}
        >
          <option value="tight">{tr(locale, "Tight", "紧贴内容")}</option>
          <option value="include_padding">{tr(locale, "Include Padding", "包含内边距")}</option>
        </select>
      </div>
      </div>
      <ResizablePanelGrip />
    </Card>
  );
}
