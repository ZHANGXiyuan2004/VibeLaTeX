import { toPng, toSvg } from "html-to-image";

import type { BackgroundMode, ExportScale } from "@/shared/types";

export function getExportBackground(mode: BackgroundMode, color: string): string {
  return mode === "transparent" ? "transparent" : color;
}

export function clampPadding(padding: number): number {
  return Math.max(0, Math.min(64, Math.round(padding)));
}

export function normalizeScale(scale: number): ExportScale {
  if (scale >= 4) return 4;
  if (scale >= 2) return 2;
  return 1;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    throw new Error("Invalid data URL.");
  }

  const meta = dataUrl.slice(0, commaIndex);
  const data = dataUrl.slice(commaIndex + 1);
  const mime = /data:([^;,]+)/.exec(meta)?.[1] ?? "application/octet-stream";
  const isBase64 = /;base64/i.test(meta);

  if (isBase64) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new Blob([bytes], { type: mime });
  }

  const text = decodeURIComponent(data);
  return new Blob([text], { type: mime });
}

function buildExportOptions(options: {
  scale: ExportScale;
  backgroundMode: BackgroundMode;
  backgroundColor: string;
}) {
  return {
    pixelRatio: options.scale,
    backgroundColor: getExportBackground(options.backgroundMode, options.backgroundColor),
    cacheBust: true,
    // Avoid html-to-image scanning all stylesheets for font embedding.
    // Cross-origin stylesheets (extensions/CDN) can throw SecurityError and break export.
    skipFonts: true,
  };
}

export async function exportNodeToSvg(
  node: HTMLElement,
  options: {
    scale: ExportScale;
    backgroundMode: BackgroundMode;
    backgroundColor: string;
  },
): Promise<Blob> {
  const dataUrl = await toSvg(node, buildExportOptions(options));

  return dataUrlToBlob(dataUrl);
}

export async function exportNodeToPng(
  node: HTMLElement,
  options: {
    scale: ExportScale;
    backgroundMode: BackgroundMode;
    backgroundColor: string;
  },
): Promise<Blob> {
  const dataUrl = await toPng(node, buildExportOptions(options));

  return dataUrlToBlob(dataUrl);
}

export async function exportNodeToSvgText(
  node: HTMLElement,
  options: {
    scale: ExportScale;
    backgroundMode: BackgroundMode;
    backgroundColor: string;
  },
): Promise<string> {
  const blob = await exportNodeToSvg(node, options);
  return blob.text();
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function copyTextByExecCommand(text: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let success = false;
  try {
    success = document.execCommand("copy");
  } catch {
    success = false;
  } finally {
    textarea.remove();
  }

  return success;
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fallback to execCommand.
    }
  }

  if (copyTextByExecCommand(text)) {
    return;
  }

  throw new Error("Clipboard write is not available in the current browser context.");
}

export function canCopyPngToClipboard(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const clipboard = navigator.clipboard as Clipboard & {
    write?: (data: ClipboardItem[]) => Promise<void>;
  };

  return typeof clipboard?.write === "function" && typeof window.ClipboardItem !== "undefined";
}

export async function copyPngBlobToClipboard(blob: Blob): Promise<void> {
  if (!canCopyPngToClipboard()) {
    throw new Error("PNG clipboard is not supported in this browser.");
  }

  const clipboard = navigator.clipboard as Clipboard & {
    write: (data: ClipboardItem[]) => Promise<void>;
  };

  await clipboard.write([
    new ClipboardItem({
      "image/png": blob,
    }),
  ]);
}
