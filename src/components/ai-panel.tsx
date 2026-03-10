"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageUp, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ResizablePanelGrip } from "@/components/ui/resizable-panel-grip";
import { Textarea } from "@/components/ui/textarea";
import {
  imageSourceLabel,
  validateImageFileBasics,
  validateImageResolution,
  type ImageInputSource,
} from "@/lib/image-input";
import {
  applyDiffSegmentDecisions,
  buildLatexDiff,
  buildLatexDiffSegments,
  type DiffSegmentDecision,
} from "@/lib/latex-diff";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { LlmAction, LlmActionResponse, UiLocale } from "@/shared/types";

interface AiPanelProps {
  locale: UiLocale;
  latex: string;
  renderError: string | null;
  visionEnabled: boolean;
  featureFlags: {
    format: boolean;
    fix: boolean;
    refactor: boolean;
    nlToLatex: boolean;
    explain: boolean;
    imageToLatex: boolean;
  };
  onTrackAiCall: () => void;
  onApply: (nextLatex: string) => void;
}

type SegmentState = "pending" | DiffSegmentDecision;
type ImageInputState = "idle" | "uploading" | "processing" | "success" | "error";

function actionLabel(action: LlmAction, locale: UiLocale): string {
  if (action === "format_latex") return tr(locale, "Format", "格式化");
  if (action === "fix_latex") return tr(locale, "Fix", "修复");
  if (action === "refactor_latex") return tr(locale, "Refactor", "重构");
  if (action === "nl_to_latex") return tr(locale, "NL → LaTeX", "自然语言 → LaTeX");
  if (action === "explain_latex") return tr(locale, "Explain", "解释");
  if (action === "img_to_latex") return tr(locale, "Image → LaTeX", "图片 → LaTeX");
  return action;
}

function decodeCommonJsonEscapes(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\");
}

function extractJsonBlock(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return trimmed.slice(first, last + 1);
  }
  return null;
}

function extractCodeFence(text: string): string | null {
  const match = /```(?:latex|tex)?\s*([\s\S]*?)```/i.exec(text);
  return match?.[1]?.trim() ?? null;
}

function extractMathDelimited(text: string): string | null {
  const display = /\\\[([\s\S]*?)\\\]/.exec(text);
  if (display?.[1]) {
    return display[1].trim();
  }

  const dollars = /\$\$([\s\S]*?)\$\$/.exec(text);
  if (dollars?.[1]) {
    return dollars[1].trim();
  }

  const inline = /\$([\s\S]*?)\$/.exec(text);
  if (inline?.[1]) {
    return inline[1].trim();
  }

  return null;
}

export function sanitizeLatexForApply(input: string): string {
  let text = input.trim();
  if (!text) {
    return "";
  }

  const maybeJson = extractJsonBlock(text);
  if (maybeJson) {
    try {
      const parsed = JSON.parse(maybeJson) as { latex?: unknown };
      if (typeof parsed.latex === "string") {
        text = parsed.latex.trim();
      }
    } catch {
      // Ignore JSON parse failure.
    }
  }

  text = text.replace(/^\s*(?:latex|tex)\s*[:：]\s*/i, "").trim();

  const fenced = extractCodeFence(text);
  if (fenced) {
    text = fenced;
  }

  const delimited = extractMathDelimited(text);
  if (delimited) {
    text = delimited;
  }

  text = decodeCommonJsonEscapes(text).trim();

  if (/^["'`]/.test(text) && /["'`]$/.test(text)) {
    text = text.slice(1, -1).trim();
  }

  if (/[\n\r]\s*(?:changes|explanation|analysis|reasoning)\s*:/i.test(text)) {
    text = text
      .split(/\r?\n/)
      .filter((line) => !/^\s*(?:changes|explanation|analysis|reasoning)\s*:/i.test(line))
      .join("\n")
      .trim();
  }

  if (/^\{[\s\S]*\}$/.test(text) && /"\w+"\s*:/.test(text)) {
    return "";
  }

  return text;
}

function streamPreviewText(raw: string): string {
  const preview = sanitizeLatexForApply(raw);
  if (preview) {
    return preview;
  }

  const compact = decodeCommonJsonEscapes(raw)
    .replace(/^\s*\{+/, "")
    .replace(/\}+$/, "")
    .replace(/"\s*,\s*"/g, "\n")
    .replace(/"\s*:\s*"/g, ": ")
    .replace(/\\"/g, "\"")
    .trim();

  if (!compact) {
    return "...";
  }

  return compact.length > 500 ? `${compact.slice(0, 500)}...` : compact;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read image file."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function detectImageResolution(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => reject(new Error("Failed to decode image resolution."));
    image.src = dataUrl;
  });
}

function getImageStateLabel(state: ImageInputState): string {
  if (state === "uploading") return "uploading";
  if (state === "processing") return "processing";
  if (state === "success") return "success";
  if (state === "error") return "error";
  return "idle";
}

export function AiPanel({
  locale,
  latex,
  renderError,
  visionEnabled,
  featureFlags,
  onTrackAiCall,
  onApply,
}: AiPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LlmActionResponse | null>(null);
  const [status, setStatus] = useState<string>("");
  const [instruction, setInstruction] = useState<string>("");
  const [lastAction, setLastAction] = useState<LlmAction | null>(null);
  const [liveResponse, setLiveResponse] = useState<string>("");
  const [imageDataUrl, setImageDataUrl] = useState<string>("");
  const [imageName, setImageName] = useState<string>("");
  const [imageInputState, setImageInputState] = useState<ImageInputState>("idle");
  const [imageInputSource, setImageInputSource] = useState<ImageInputSource>("upload");
  const [isDropActive, setIsDropActive] = useState(false);
  const [segmentStates, setSegmentStates] = useState<Record<string, SegmentState>>({});
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const resetImageSelection = useCallback(() => {
    setImageDataUrl("");
    setImageName("");
    setImageInputSource("upload");
    setImageInputState("idle");
  }, []);

  const ingestImageFile = useCallback(async (file: File, source: ImageInputSource) => {
    const fileError = validateImageFileBasics(file);
    if (fileError) {
      setImageInputState("error");
      setStatus(fileError);
      return;
    }

    setImageInputState("uploading");
    setImageInputSource(source);
    setStatus(
      tr(locale, `Reading image from ${imageSourceLabel(source)}...`, `正在从${imageSourceLabel(source)}读取图片...`),
    );

    try {
      const dataUrl = await fileToDataUrl(file);
      const { width, height } = await detectImageResolution(dataUrl);
      const resolutionError = validateImageResolution(width, height);
      if (resolutionError) {
        setImageInputState("error");
        setStatus(resolutionError);
        return;
      }

      setImageDataUrl(dataUrl);
      setImageName(file.name || `formula-${Date.now()}.png`);
      setImageInputState("success");
      setStatus(
        tr(
          locale,
          `Image ready via ${imageSourceLabel(source)} (${Math.round(width)}x${Math.round(height)}).`,
          `图片已就绪（${imageSourceLabel(source)}，${Math.round(width)}x${Math.round(height)}）。`,
        ),
      );
    } catch (error) {
      setImageInputState("error");
      setStatus(error instanceof Error ? error.message : tr(locale, "Failed to read image.", "读取图片失败。"));
    }
  }, [locale]);

  useEffect(() => {
    if (!featureFlags.imageToLatex || !visionEnabled) {
      return;
    }

    const onPaste = (event: ClipboardEvent) => {
      const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) =>
        item.type.startsWith("image/"),
      );
      if (!imageItem) {
        return;
      }

      const file = imageItem.getAsFile();
      if (!file) {
        return;
      }

      event.preventDefault();
      void ingestImageFile(file, "paste");
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [featureFlags.imageToLatex, ingestImageFile, visionEnabled]);

  const runAction = async (action: LlmAction) => {
    if (action === "fix_latex" && !renderError) {
      setStatus(tr(locale, "Fix requires a current render error.", "Fix 需要当前存在渲染错误。"));
      return;
    }

    if (action === "nl_to_latex" && !instruction.trim()) {
      setStatus(tr(locale, "NL → LaTeX requires a natural language instruction.", "NL → LaTeX 需要自然语言描述。"));
      return;
    }

    if (action === "img_to_latex") {
      if (!visionEnabled || !featureFlags.imageToLatex) {
        setStatus(tr(locale, "Current model does not support image-to-LaTeX.", "当前模型不支持 Image-to-LaTeX。"));
        return;
      }

      if (!imageDataUrl) {
        setStatus(tr(locale, "Please upload, drag, or paste a formula image first.", "请先上传、拖拽或粘贴一张公式图片。"));
        return;
      }
    }

    setLoading(true);
    if (action === "img_to_latex") {
      setImageInputState("processing");
    }
    setStatus("");
    setLiveResponse("");
    setResult(null);
    setLastAction(action);
    setSegmentStates({});
    onTrackAiCall();

    try {
      const response = await fetch("/api/llm/action/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          latex,
          instruction: action === "nl_to_latex" ? instruction : undefined,
          error_message: action === "fix_latex" ? renderError : undefined,
          image: action === "img_to_latex" ? imageDataUrl : undefined,
          constraints: {
            katex_compatible: true,
          },
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        if (action === "img_to_latex") {
          setImageInputState("error");
        }
        setStatus(data?.error ?? tr(locale, "AI call failed.", "AI 调用失败。"));
        return;
      }

      if (!response.body) {
        if (action === "img_to_latex") {
          setImageInputState("error");
        }
        setStatus(tr(locale, "Stream is unavailable for this response.", "该响应不支持流式返回。"));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }

          try {
            const event = JSON.parse(trimmed) as
              | { type: "delta"; text?: string }
              | { type: "done"; result: LlmActionResponse }
              | { type: "error"; error?: string };

            if (event.type === "delta") {
              if (event.text) {
                setLiveResponse((previous) => previous + event.text);
              }
              continue;
            }

            if (event.type === "done") {
              setResult(event.result);
              setLiveResponse("");
              if (action === "img_to_latex") {
                setImageInputState(event.result.ok ? "success" : "error");
              }
              if (!event.result.ok) {
                setStatus(event.result.error ?? tr(locale, "AI call failed.", "AI 调用失败。"));
              }
              continue;
            }

            if (event.type === "error") {
              if (action === "img_to_latex") {
                setImageInputState("error");
              }
              setStatus(event.error ?? tr(locale, "AI stream failed.", "AI 流式请求失败。"));
            }
          } catch {
            // Ignore malformed chunks.
          }
        }
      }

      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim()) as
            | { type: "done"; result: LlmActionResponse }
            | { type: "error"; error?: string };
          if (event.type === "done") {
            setResult(event.result);
            setLiveResponse("");
            if (action === "img_to_latex") {
              setImageInputState(event.result.ok ? "success" : "error");
            }
            if (!event.result.ok) {
              setStatus(event.result.error ?? tr(locale, "AI call failed.", "AI 调用失败。"));
            }
          } else if (event.type === "error") {
            if (action === "img_to_latex") {
              setImageInputState("error");
            }
            setStatus(event.error ?? tr(locale, "AI stream failed.", "AI 流式请求失败。"));
          }
        } catch {
          // Ignore trailing malformed chunk.
        }
      }
    } catch (error) {
      if (action === "img_to_latex") {
        setImageInputState("error");
      }
      setStatus(error instanceof Error ? error.message : tr(locale, "AI call failed.", "AI 调用失败。"));
    } finally {
      setLoading(false);
    }
  };

  const cleanedLatex = result ? sanitizeLatexForApply(result.latex) : "";
  const displayLatex = cleanedLatex || result?.latex || "";
  const assistantExplanation = result?.explanation || result?.reasoning || "";
  const showDiff = Boolean(
    result && result.ok && cleanedLatex.trim().length > 0 && cleanedLatex !== latex,
  );
  const diffText = showDiff ? buildLatexDiff(latex, cleanedLatex) : "";

  const diffSegments = useMemo(
    () => (showDiff ? buildLatexDiffSegments(latex, cleanedLatex) : []),
    [cleanedLatex, latex, showDiff],
  );

  const changedSegments = useMemo(
    () => diffSegments.filter((segment) => segment.kind === "changed"),
    [diffSegments],
  );

  useEffect(() => {
    const nextStates: Record<string, SegmentState> = {};
    for (const segment of changedSegments) {
      nextStates[segment.id] = "pending";
    }
    setSegmentStates(nextStates);
  }, [changedSegments]);

  const canApply = Boolean(
    result &&
      result.ok &&
      cleanedLatex.trim().length > 0 &&
      lastAction !== "explain_latex",
  );

  const acceptedCount = changedSegments.filter((segment) => segmentStates[segment.id] === "accepted").length;

  return (
    <Card
      data-resizable-panel="true"
      className="resizable-panel flex h-[520px] min-h-[520px] min-w-0 flex-col overflow-hidden"
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-2 pb-3">
      <div>
        <CardTitle>{tr(locale, "AI Assistant", "AI 助手")}</CardTitle>
        <CardDescription>
          {tr(locale, "Formula content will be sent to your configured LLM service.", "公式内容会发送到你配置的 LLM 服务。")}
        </CardDescription>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading || !featureFlags.format}
          onClick={() => runAction("format_latex")}
        >
          {tr(locale, "Format", "格式化")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading || !renderError || !featureFlags.fix}
          onClick={() => runAction("fix_latex")}
        >
          {tr(locale, "Fix", "修复")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading || !featureFlags.refactor}
          onClick={() => runAction("refactor_latex")}
        >
          {tr(locale, "Refactor", "重构")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading || !featureFlags.nlToLatex}
          onClick={() => runAction("nl_to_latex")}
        >
          NL → LaTeX
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading || !featureFlags.explain}
          onClick={() => runAction("explain_latex")}
        >
          {tr(locale, "Explain", "解释")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading || !featureFlags.imageToLatex || !visionEnabled}
          onClick={() => runAction("img_to_latex")}
        >
          {tr(locale, "Image → LaTeX", "图片 → LaTeX")}
        </Button>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-slate-400">{tr(locale, "Natural language input (for NL → LaTeX)", "自然语言输入（用于 NL → LaTeX）")}</p>
        <Textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          className="min-h-28"
          placeholder={tr(
            locale,
            "Describe the formula you want, e.g. sum of geometric series.",
            "描述你想要的公式，例如：等比数列求和。",
          )}
        />
      </div>

      <div className="space-y-1">
        <p className="text-xs text-slate-400">{tr(locale, "Image input (for Image → LaTeX)", "图片输入（用于 Image → LaTeX）")}</p>
        {featureFlags.imageToLatex ? (
          visionEnabled ? (
            <div
              data-testid="image-dropzone"
              className={cn(
                "min-h-24 space-y-2 rounded-md border p-2 transition-colors",
                isDropActive
                  ? "border-emerald-400 bg-emerald-950/25"
                  : "border-slate-800 bg-slate-950/50",
              )}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDropActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                setIsDropActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                const nextTarget = event.relatedTarget;
                if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                  return;
                }
                setIsDropActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDropActive(false);
                const file = event.dataTransfer.files?.[0];
                if (!file) {
                  setImageInputState("error");
                  setStatus(tr(locale, "No file detected in drop payload.", "拖拽内容中未检测到文件。"));
                  return;
                }
                void ingestImageFile(file, "drop");
              }}
            >
              <div className="flex items-center gap-2 text-xs text-slate-200">
                <ImageUp className="h-3.5 w-3.5" />
                <span>{imageName || tr(locale, "Upload / drag / paste formula image (PNG/JPG/WebP)", "上传 / 拖拽 / 粘贴公式图片（PNG/JPG/WebP）")}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => imageInputRef.current?.click()}
                >
                  {tr(locale, "Choose image", "选择图片")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!imageDataUrl && imageInputState === "idle"}
                  onClick={() => {
                    resetImageSelection();
                    setStatus(tr(locale, "Image cleared.", "图片已清除。"));
                  }}
                >
                  {tr(locale, "Clear", "清除")}
                </Button>
              </div>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }
                  void ingestImageFile(file, "upload");
                  event.currentTarget.value = "";
                }}
              />

              <p data-testid="image-input-state" className="text-[11px] text-slate-400">
                {tr(locale, "State", "状态")}: {getImageStateLabel(imageInputState)}
              </p>
              {imageDataUrl ? (
                <p className="text-[11px] text-slate-400">
                  {tr(locale, "Ready image", "已就绪图片")}: {imageName} via {imageSourceLabel(imageInputSource)}.
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  {tr(locale, "Paste image directly with Ctrl/Cmd+V. Max size: 5MB.", "可直接 Ctrl/Cmd+V 粘贴图片。最大 5MB。")}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-amber-500/40 bg-amber-950/30 px-2 py-1 text-xs text-amber-200">
              {tr(
                locale,
                "Current model does not support image recognition (vision=false). Enable Vision and image_to_latex in /admin.",
                "当前模型不支持图片识别（vision=false）。请在 /admin 启用 Vision 与 image_to_latex。",
              )}
            </div>
          )
        ) : (
          <div className="rounded-md border border-slate-800 bg-slate-950/50 px-2 py-1 text-xs text-slate-400">
            {tr(locale, "Image-to-LaTeX feature is disabled in settings.", "设置中已禁用 Image-to-LaTeX 功能。")}
          </div>
        )}
        {imageInputState === "error" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => imageInputRef.current?.click()}
            >
              {tr(locale, "Retry image input", "重试图片输入")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                resetImageSelection();
                setStatus(tr(locale, "Switched to text input. Use NL → LaTeX or other text actions.", "已切换为文本输入，可使用 NL → LaTeX 等文本动作。"));
              }}
            >
              {tr(locale, "Switch to text input", "切换为文本输入")}
            </Button>
          </div>
        ) : null}
      </div>

      {status ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-950/30 px-2 py-1 text-xs text-amber-200">
          {status}
        </p>
      ) : null}

      {loading || liveResponse ? (
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <div className="text-[11px] tracking-wide text-slate-400">{tr(locale, "Assistant", "助手")}</div>
          <div className="flex items-start gap-2">
            <span className="mt-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <pre className="max-h-52 min-w-0 flex-1 overflow-auto rounded-xl border border-sky-500/30 bg-sky-950/25 px-3 py-2 text-xs text-sky-100 whitespace-pre-wrap break-words">
              {streamPreviewText(liveResponse)}
            </pre>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="h-3.5 w-3.5" />
            {lastAction ? `${tr(locale, "Action", "动作")}: ${actionLabel(lastAction, locale)}` : tr(locale, "AI result", "AI 结果")}
          </div>
          <Textarea value={displayLatex} readOnly className="min-h-72 break-all" />
          {showDiff ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">{tr(locale, "Diff preview", "差异预览")}</p>
              <pre className="max-h-48 overflow-auto rounded-md border border-slate-800 bg-slate-950/60 p-2 text-[11px] text-slate-300 whitespace-pre-wrap break-words">
                {diffText}
              </pre>

              {changedSegments.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>
                      {tr(
                        locale,
                        `Segment apply: ${acceptedCount} accepted / ${changedSegments.length} changed`,
                        `分段应用：已接受 ${acceptedCount} / 变更 ${changedSegments.length}`,
                      )}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const next: Record<string, SegmentState> = {};
                        for (const segment of changedSegments) {
                          next[segment.id] = "accepted";
                        }
                        setSegmentStates(next);
                      }}
                    >
                      {tr(locale, "Accept all", "全部接受")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const next: Record<string, SegmentState> = {};
                        for (const segment of changedSegments) {
                          next[segment.id] = "rejected";
                        }
                        setSegmentStates(next);
                      }}
                    >
                      {tr(locale, "Reject all", "全部拒绝")}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {changedSegments.map((segment, index) => (
                      <div
                        key={segment.id}
                        className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 p-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                          <span>{tr(locale, `Change block #${index + 1}`, `变更块 #${index + 1}`)}</span>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={segmentStates[segment.id] === "accepted" ? "secondary" : "ghost"}
                              onClick={() =>
                                setSegmentStates((previous) => ({
                                  ...previous,
                                  [segment.id]: "accepted",
                                }))
                              }
                            >
                              {tr(locale, "Accept", "接受")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={segmentStates[segment.id] === "rejected" ? "secondary" : "ghost"}
                              onClick={() =>
                                setSegmentStates((previous) => ({
                                  ...previous,
                                  [segment.id]: "rejected",
                                }))
                              }
                            >
                              {tr(locale, "Reject", "拒绝")}
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <pre className="max-h-36 overflow-auto rounded-md border border-rose-900/60 bg-rose-950/30 p-2 text-[11px] text-rose-200 whitespace-pre-wrap break-words">
                            {segment.beforeLines.join("\n") || "<empty>"}
                          </pre>
                          <pre className="max-h-36 overflow-auto rounded-md border border-emerald-900/60 bg-emerald-950/30 p-2 text-[11px] text-emerald-200 whitespace-pre-wrap break-words">
                            {segment.afterLines.join("\n") || "<empty>"}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const nextLatex = sanitizeLatexForApply(result.latex);
                if (!nextLatex) {
                  setStatus(
                    tr(locale, "AI result does not contain pure LaTeX. Please regenerate.", "AI 结果不包含纯 LaTeX，请重新生成。"),
                  );
                  return;
                }
                onApply(nextLatex);
              }}
              disabled={!canApply}
            >
              {tr(locale, "Apply whole result", "应用完整结果")}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!canApply || changedSegments.length === 0}
              onClick={() => {
                const decisionMap: Partial<Record<string, DiffSegmentDecision>> = {};
                for (const segment of changedSegments) {
                  decisionMap[segment.id] =
                    segmentStates[segment.id] === "accepted" ? "accepted" : "rejected";
                }

                const merged = applyDiffSegmentDecisions(diffSegments, decisionMap);
                if (!merged.trim()) {
                  setStatus(tr(locale, "No segment changes applied.", "未应用任何分段修改。"));
                  return;
                }

                onApply(merged);
              }}
            >
              {tr(locale, "Apply accepted segments", "应用已接受分段")}
            </Button>

            {lastAction === "explain_latex" ? (
              <p className="text-xs text-slate-500">{tr(locale, "Explain action does not modify editor content.", "Explain 动作不会修改编辑器内容。")}</p>
            ) : null}
          </div>
          {assistantExplanation ? (
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <div className="text-[11px] tracking-wide text-slate-400">{tr(locale, "Assistant", "助手")}</div>
              <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2">
                <pre className="max-h-44 overflow-auto text-sm leading-6 text-slate-200 whitespace-pre-wrap break-words">
                  {assistantExplanation}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-56 items-center justify-center rounded-md border border-dashed border-slate-700/70 text-xs text-slate-500">
          {tr(locale, "Click Format/Fix or Image → LaTeX to see AI results here.", "点击 Format/Fix 或 Image → LaTeX 后，这里会显示 AI 结果。")}
        </div>
      )}
      </div>
      <ResizablePanelGrip />
    </Card>
  );
}
