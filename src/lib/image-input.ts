export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const MAX_IMAGE_FILE_BYTES = 5 * 1024 * 1024;
export const MIN_IMAGE_SIDE_PX = 24;
export const MAX_IMAGE_SIDE_PX = 8_192;

export type ImageInputSource = "upload" | "drop" | "paste";

export interface ImageFileLike {
  type: string;
  size: number;
  name?: string;
}

export function isSupportedImageType(type: string): boolean {
  const normalized = type.trim().toLowerCase();
  return SUPPORTED_IMAGE_MIME_TYPES.includes(normalized as (typeof SUPPORTED_IMAGE_MIME_TYPES)[number]);
}

export function validateImageFileBasics(file: ImageFileLike): string | null {
  if (!isSupportedImageType(file.type)) {
    return "Only PNG/JPG/WebP images are supported.";
  }

  if (file.size <= 0) {
    return "Image file is empty.";
  }

  if (file.size > MAX_IMAGE_FILE_BYTES) {
    return `Image is too large (${Math.round(file.size / 1024)} KB). Max size is 5120 KB.`;
  }

  return null;
}

export function validateImageResolution(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "Unable to detect image resolution.";
  }

  if (width < MIN_IMAGE_SIDE_PX || height < MIN_IMAGE_SIDE_PX) {
    return `Image resolution is too small (${Math.round(width)}x${Math.round(height)}). Minimum is ${MIN_IMAGE_SIDE_PX}x${MIN_IMAGE_SIDE_PX}.`;
  }

  if (width > MAX_IMAGE_SIDE_PX || height > MAX_IMAGE_SIDE_PX) {
    return `Image resolution is too large (${Math.round(width)}x${Math.round(height)}). Maximum is ${MAX_IMAGE_SIDE_PX}x${MAX_IMAGE_SIDE_PX}.`;
  }

  return null;
}

export function imageSourceLabel(source: ImageInputSource): string {
  if (source === "drop") {
    return "drag-and-drop";
  }
  if (source === "paste") {
    return "paste";
  }
  return "upload";
}
