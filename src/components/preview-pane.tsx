"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import { ResizablePanelGrip } from "@/components/ui/resizable-panel-grip";
import { tr } from "@/lib/i18n";
import type { PreviewStyleState, UiLocale } from "@/shared/types";
import { cn } from "@/lib/utils";

export interface PreviewPaneHandle {
  tightNode: HTMLDivElement | null;
  paddedNode: HTMLDivElement | null;
}

interface PreviewPaneProps {
  locale: UiLocale;
  renderedHtml: string;
  errorMessage: string | null;
  styleState: PreviewStyleState;
}

function formulaAlignStyle(align: PreviewStyleState["align"]): {
  marginLeft: string;
  marginRight: string;
} {
  if (align === "left") {
    return { marginLeft: "0", marginRight: "auto" };
  }
  if (align === "right") {
    return { marginLeft: "auto", marginRight: "0" };
  }
  return { marginLeft: "auto", marginRight: "auto" };
}

export const PreviewPane = forwardRef<PreviewPaneHandle, PreviewPaneProps>(
  ({ locale, renderedHtml, errorMessage, styleState }, ref) => {
    const tightRef = useRef<HTMLDivElement | null>(null);
    const paddedRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle(ref, () => ({
      tightNode: tightRef.current,
      paddedNode: paddedRef.current,
    }));

    const previewScaleStyle = useMemo(
      () => ({
        transform: `scale(${styleState.preview_scale})`,
        transformOrigin: "top left",
        width: `${100 / styleState.preview_scale}%`,
      }),
      [styleState.preview_scale],
    );

    return (
      <div
        data-resizable-panel="true"
        className="resizable-panel flex h-[220px] min-h-[220px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 p-3 shadow-inner shadow-black/30"
      >
        <div className="min-h-0 flex flex-1 flex-col pr-3 pb-3">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span>{tr(locale, "Preview", "预览")}</span>
            <span>
              {styleState.render_engine === "mathjax" ? "MathJax" : "KaTeX"} ·{" "}
              {errorMessage ? tr(locale, "Render Failed", "渲染失败") : tr(locale, "Render OK", "渲染成功")}
            </span>
          </div>
          <div
            className={cn(
              "min-h-0 flex-1 rounded-lg border border-slate-800",
              styleState.background_mode === "transparent" ? "checkerboard-bg" : "",
            )}
            style={
              styleState.background_mode === "solid"
                ? { backgroundColor: styleState.background_color }
                : undefined
            }
          >
            <div className="vibelatex-preview-scroll h-full overflow-auto">
              <div style={previewScaleStyle}>
                <div ref={paddedRef} style={{ minWidth: "max-content", padding: `${styleState.padding}px` }}>
                  <div className="inline-block min-w-max">
                    <div
                      ref={tightRef}
                      className="vibelatex-formula-content"
                      style={{
                        color: styleState.text_color,
                        fontSize: `${styleState.font_size}px`,
                        display: "block",
                        width: "max-content",
                        minWidth: "max-content",
                        maxWidth: "none",
                        ...formulaAlignStyle(styleState.align),
                      }}
                      dangerouslySetInnerHTML={{ __html: renderedHtml }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {errorMessage ? (
            <p className="mt-2 rounded-md border border-rose-500/40 bg-rose-950/30 px-2 py-1 text-xs text-rose-300">
              {errorMessage}
            </p>
          ) : null}
        </div>
        <ResizablePanelGrip />
      </div>
    );
  },
);

PreviewPane.displayName = "PreviewPane";
