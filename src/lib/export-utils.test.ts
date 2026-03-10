import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("html-to-image", () => ({
  toSvg: vi.fn(),
  toPng: vi.fn(),
}));

import { toPng, toSvg } from "html-to-image";
const toSvgMock = vi.mocked(toSvg);
const toPngMock = vi.mocked(toPng);

import {
  clampPadding,
  dataUrlToBlob,
  exportNodeToPng,
  exportNodeToSvg,
  getExportBackground,
  normalizeScale,
} from "@/lib/export-utils";

describe("export-utils", () => {
  beforeEach(() => {
    toSvgMock.mockReset();
    toPngMock.mockReset();
  });

  it("clamps padding into valid range", () => {
    expect(clampPadding(-5)).toBe(0);
    expect(clampPadding(12.8)).toBe(13);
    expect(clampPadding(80)).toBe(64);
  });

  it("normalizes export scale", () => {
    expect(normalizeScale(1)).toBe(1);
    expect(normalizeScale(3)).toBe(2);
    expect(normalizeScale(5)).toBe(4);
  });

  it("picks export background", () => {
    expect(getExportBackground("transparent", "#fff")).toBe("transparent");
    expect(getExportBackground("solid", "#fff")).toBe("#fff");
  });

  it("converts non-base64 svg data url to blob", async () => {
    const blob = dataUrlToBlob(
      "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3C%2Fsvg%3E",
    );

    expect(blob.type).toBe("image/svg+xml");
    expect(await blob.text()).toContain("<svg");
  });

  it("exports svg with skipFonts option to avoid cross-origin stylesheet errors", async () => {
    toSvgMock.mockResolvedValue(
      "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3C%2Fsvg%3E",
    );

    await exportNodeToSvg({} as HTMLElement, {
      scale: 2,
      backgroundMode: "transparent",
      backgroundColor: "#ffffff",
    });

    expect(toSvgMock).toHaveBeenCalledTimes(1);
    expect(toSvgMock.mock.calls[0]?.[1]).toMatchObject({
      pixelRatio: 2,
      backgroundColor: "transparent",
      cacheBust: true,
      skipFonts: true,
    });
  });

  it("exports png with skipFonts option to avoid cross-origin stylesheet errors", async () => {
    toPngMock.mockResolvedValue("data:image/png;base64,AA==");

    await exportNodeToPng({} as HTMLElement, {
      scale: 4,
      backgroundMode: "solid",
      backgroundColor: "#ffffff",
    });

    expect(toPngMock).toHaveBeenCalledTimes(1);
    expect(toPngMock.mock.calls[0]?.[1]).toMatchObject({
      pixelRatio: 4,
      backgroundColor: "#ffffff",
      cacheBust: true,
      skipFonts: true,
    });
  });
});
