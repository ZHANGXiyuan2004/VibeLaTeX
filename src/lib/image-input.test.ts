import {
  MAX_IMAGE_FILE_BYTES,
  imageSourceLabel,
  isSupportedImageType,
  validateImageFileBasics,
  validateImageResolution,
} from "@/lib/image-input";

describe("image-input", () => {
  it("validates supported mime types", () => {
    expect(isSupportedImageType("image/png")).toBe(true);
    expect(isSupportedImageType("IMAGE/JPEG")).toBe(true);
    expect(isSupportedImageType("application/pdf")).toBe(false);
  });

  it("rejects unsupported and oversize files", () => {
    expect(validateImageFileBasics({
      type: "text/plain",
      size: 1024,
      name: "x.txt",
    })).toContain("PNG/JPG/WebP");

    expect(validateImageFileBasics({
      type: "image/png",
      size: MAX_IMAGE_FILE_BYTES + 1,
      name: "oversize.png",
    })).toContain("too large");
  });

  it("validates resolution bounds", () => {
    expect(validateImageResolution(12, 128)).toContain("too small");
    expect(validateImageResolution(10_000, 100)).toContain("too large");
    expect(validateImageResolution(120, 80)).toBeNull();
  });

  it("maps image source labels", () => {
    expect(imageSourceLabel("upload")).toBe("upload");
    expect(imageSourceLabel("drop")).toBe("drag-and-drop");
    expect(imageSourceLabel("paste")).toBe("paste");
  });
});
