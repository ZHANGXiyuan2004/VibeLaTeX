"use client";

import type { PointerEvent } from "react";

function readMinHeight(panel: HTMLElement): number {
  const computed = Number.parseFloat(window.getComputedStyle(panel).minHeight);
  if (Number.isFinite(computed) && computed > 0) {
    return computed;
  }
  return 120;
}

export function ResizablePanelGrip() {
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    const panel = event.currentTarget.closest<HTMLElement>("[data-resizable-panel='true']");
    if (!panel) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const startY = event.clientY;
    const startHeight = panel.getBoundingClientRect().height;
    const minHeight = readMinHeight(panel);
    const previousUserSelect = document.body.style.userSelect;

    panel.classList.add("resizable-panel--dragging");
    document.body.style.userSelect = "none";

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const nextHeight = Math.max(minHeight, startHeight + deltaY);
      panel.style.height = `${Math.round(nextHeight)}px`;
    };

    const onEnd = () => {
      panel.classList.remove("resizable-panel--dragging");
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };

  return (
    <button
      type="button"
      className="resizable-panel-grip"
      aria-label="Resize panel vertically"
      onPointerDown={onPointerDown}
    >
      <span className="resizable-panel-grip-lines" />
    </button>
  );
}

