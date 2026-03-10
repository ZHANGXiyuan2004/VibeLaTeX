"use client";

import { Copy, Download, FileCode2, Image as ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tr } from "@/lib/i18n";
import type { ExportFormat, PdfExportOptions, UiLocale } from "@/shared/types";

interface ExportToolbarProps {
  locale: UiLocale;
  busy: boolean;
  status: string;
  canCopyPng: boolean;
  pdfEnabled: boolean;
  pdfOptions: PdfExportOptions;
  onExport: (format: ExportFormat) => void;
  onExportPdf: () => void;
  onPdfOptionsChange: (next: PdfExportOptions) => void;
  onCopyLatex: () => void;
  onCopySvgText: () => void;
  onCopyPng: () => void;
}

export function ExportToolbar({
  locale,
  busy,
  status,
  canCopyPng,
  pdfEnabled,
  pdfOptions,
  onExport,
  onExportPdf,
  onPdfOptionsChange,
  onCopyLatex,
  onCopySvgText,
  onCopyPng,
}: ExportToolbarProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCopyLatex}>
          <FileCode2 className="mr-1 h-3.5 w-3.5" />
          {tr(locale, "Copy LaTeX", "复制 LaTeX")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCopySvgText} disabled={busy}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          {tr(locale, "Copy SVG", "复制 SVG")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCopyPng} disabled={busy || !canCopyPng}>
          <ImageIcon className="mr-1 h-3.5 w-3.5" />
          {tr(locale, "Copy PNG", "复制 PNG")}
        </Button>

        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => onExport("svg")}>
          <Download className="mr-1 h-3.5 w-3.5" />
          {tr(locale, "SVG", "下载 SVG")}
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => onExport("png")}>
          <Download className="mr-1 h-3.5 w-3.5" />
          {tr(locale, "PNG", "下载 PNG")}
        </Button>
        <div className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1">
          <Badge className="pdf-beta-badge">PDF Beta</Badge>
          <select
            aria-label={tr(locale, "PDF page size", "PDF 页面尺寸")}
            className="h-7 rounded border border-slate-700 bg-slate-950 px-1.5 text-[11px] text-slate-200"
            value={pdfOptions.page_size}
            onChange={(event) =>
              onPdfOptionsChange({
                ...pdfOptions,
                page_size: event.target.value as PdfExportOptions["page_size"],
              })
            }
          >
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
          </select>
          <select
            aria-label={tr(locale, "PDF margin", "PDF 页边距")}
            className="h-7 rounded border border-slate-700 bg-slate-950 px-1.5 text-[11px] text-slate-200"
            value={pdfOptions.margin_pt}
            onChange={(event) =>
              onPdfOptionsChange({
                ...pdfOptions,
                margin_pt: Number(event.target.value) as PdfExportOptions["margin_pt"],
              })
            }
          >
            <option value={12}>12pt</option>
            <option value={24}>24pt</option>
            <option value={36}>36pt</option>
          </select>
          <select
            aria-label={tr(locale, "PDF background mode", "PDF 背景模式")}
            className="h-7 rounded border border-slate-700 bg-slate-950 px-1.5 text-[11px] text-slate-200"
            value={pdfOptions.background_mode}
            onChange={(event) =>
              onPdfOptionsChange({
                ...pdfOptions,
                background_mode: event.target.value as PdfExportOptions["background_mode"],
              })
            }
          >
            <option value="transparent">{tr(locale, "Transparent", "透明")}</option>
            <option value="solid">{tr(locale, "Solid", "纯色")}</option>
          </select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy || !pdfEnabled}
            onClick={onExportPdf}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            {tr(locale, "Download PDF", "下载 PDF")}
          </Button>
        </div>
      </div>
      <div className="min-h-5 text-xs">
        {status ? <p className="vibelatex-export-status">{status}</p> : null}
      </div>
    </div>
  );
}
