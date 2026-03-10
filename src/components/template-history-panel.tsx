"use client";

import { Shapes } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ResizablePanelGrip } from "@/components/ui/resizable-panel-grip";
import { tr } from "@/lib/i18n";
import type { UiLocale } from "@/shared/types";

interface TemplateHistoryPanelProps {
  locale: UiLocale;
  onUseTemplate: (latex: string) => void;
}

interface LatexTemplate {
  label: string;
  latex: string;
}

export const BUILTIN_TEMPLATES: LatexTemplate[] = [
  { label: "Fraction", latex: String.raw`\frac{a}{b}` },
  { label: "Matrix", latex: String.raw`\begin{bmatrix} a & b \\ c & d \end{bmatrix}` },
  { label: "Cases", latex: String.raw`f(x)=\begin{cases}x^2,&x\ge0\\-x,&x<0\end{cases}` },
  {
    label: "Aligned",
    latex: String.raw`\begin{aligned}a^2-b^2&=(a-b)(a+b)\\x^2+y^2&=r^2\end{aligned}`,
  },
  { label: "Integral", latex: String.raw`\int_{a}^{b} f(x)\,\mathrm{d}x` },
  { label: "Summation", latex: String.raw`\sum_{k=1}^{n} k = \frac{n(n+1)}{2}` },
  { label: "Limit", latex: String.raw`\lim_{x\to0}\frac{\sin x}{x}=1` },
  { label: "Derivative", latex: String.raw`\frac{\mathrm{d}}{\mathrm{d}x}\left(x^n\right)=nx^{n-1}` },
];

export function TemplateHistoryPanel({ locale, onUseTemplate }: TemplateHistoryPanelProps) {
  return (
    <Card
      data-resizable-panel="true"
      className="resizable-panel flex h-[170px] min-h-[170px] flex-col overflow-hidden"
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shapes className="h-4 w-4" />
              {tr(locale, "Templates", "模板")}
            </CardTitle>
            <CardDescription>{tr(locale, "Insert a starter formula quickly", "快速插入常用公式模板")}</CardDescription>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {BUILTIN_TEMPLATES.map((template) => (
            <Button
              key={template.label}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onUseTemplate(template.latex)}
            >
              {template.label}
            </Button>
          ))}
        </div>
      </div>
      <ResizablePanelGrip />
    </Card>
  );
}
