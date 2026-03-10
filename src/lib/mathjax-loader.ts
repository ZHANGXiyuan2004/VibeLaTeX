import type { LatexMode } from "@/shared/types";

interface MathJaxDocument {
  clear: () => void;
  updateDocument: () => void;
}

interface MathJaxApi {
  tex2svgPromise: (latex: string, options?: { display?: boolean }) => Promise<HTMLElement>;
  tex?: {
    macros?: Record<string, string>;
    inlineMath?: string[][];
    displayMath?: string[][];
    processEscapes?: boolean;
  };
  svg?: {
    fontCache?: "none" | "local" | "global";
  };
  startup?: {
    typeset?: boolean;
    document?: MathJaxDocument;
  };
}

declare global {
  interface Window {
    MathJax?: MathJaxApi & Record<string, unknown>;
    __vibelatexMathJaxPromise?: Promise<MathJaxApi>;
  }
}

const MATHJAX_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js";

function buildMathWrapper(latex: string, mode: LatexMode): string {
  if (mode === "inline") {
    return String.raw`\(${latex}\)`;
  }
  return String.raw`\[${latex}\]`;
}

export async function ensureMathJaxLoaded(macros: Record<string, string> = {}): Promise<MathJaxApi> {
  if (typeof window === "undefined") {
    throw new Error("MathJax can only be loaded in browser.");
  }

  if (window.MathJax?.tex2svgPromise) {
    return window.MathJax;
  }

  if (window.__vibelatexMathJaxPromise) {
    return window.__vibelatexMathJaxPromise;
  }

  window.MathJax = {
    ...window.MathJax,
    tex: {
      inlineMath: [["\\(", "\\)"]],
      displayMath: [["\\[", "\\]"]],
      processEscapes: true,
      macros,
    },
    svg: {
      fontCache: "none",
    },
    startup: {
      typeset: false,
    },
  } as MathJaxApi & Record<string, unknown>;

  window.__vibelatexMathJaxPromise = new Promise<MathJaxApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-vibelatex-mathjax="1"]');
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.MathJax?.tex2svgPromise) {
          resolve(window.MathJax);
        } else {
          reject(new Error("MathJax loaded but API is unavailable."));
        }
      });
      existing.addEventListener("error", () => reject(new Error("Failed to load MathJax script.")));
      return;
    }

    const script = document.createElement("script");
    script.src = MATHJAX_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.vibelatexMathjax = "1";

    script.onload = () => {
      if (window.MathJax?.tex2svgPromise) {
        resolve(window.MathJax);
      } else {
        reject(new Error("MathJax loaded but API is unavailable."));
      }
    };
    script.onerror = () => reject(new Error("Failed to load MathJax script."));
    document.head.appendChild(script);
  }).catch((error) => {
    window.__vibelatexMathJaxPromise = undefined;
    throw error;
  });

  const loaded = await window.__vibelatexMathJaxPromise;
  loaded.tex = {
    ...(loaded.tex ?? {}),
    macros,
  };
  return loaded;
}

export async function renderMathJaxToHtml(
  latex: string,
  mode: LatexMode,
  macros: Record<string, string> = {},
): Promise<string> {
  const mathjax = await ensureMathJaxLoaded(macros);
  mathjax.tex = {
    ...(mathjax.tex ?? {}),
    macros,
  };
  const node = await mathjax.tex2svgPromise(buildMathWrapper(latex, mode), {
    display: mode === "block",
  });

  mathjax.startup?.document?.clear();
  mathjax.startup?.document?.updateDocument();

  return node.outerHTML;
}
