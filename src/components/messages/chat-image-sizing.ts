export interface ChatImageDimensions {
  width: number;
  height: number;
}

export interface ChatImageFrame extends ChatImageDimensions {
  contentFit: "contain" | "cover";
  isExtreme: boolean;
}

const measuredSizes = new Map<string, ChatImageDimensions>();
const MAX_CACHED_IMAGE_SIZES = 250;

export function validChatImageDimensions(width: unknown, height: unknown): ChatImageDimensions | null {
  if (
    typeof width !== "number" ||
    !Number.isFinite(width) ||
    width <= 0 ||
    typeof height !== "number" ||
    !Number.isFinite(height) ||
    height <= 0
  ) {
    return null;
  }
  return { width, height };
}

export function getMeasuredChatImageSize(url: string): ChatImageDimensions | null {
  return measuredSizes.get(url) ?? null;
}

export function cacheMeasuredChatImageSize(url: string, width: unknown, height: unknown): ChatImageDimensions | null {
  const dimensions = validChatImageDimensions(width, height);
  if (dimensions) {
    measuredSizes.delete(url);
    measuredSizes.set(url, dimensions);
    if (measuredSizes.size > MAX_CACHED_IMAGE_SIZES) {
      const oldestUrl = measuredSizes.keys().next().value;
      if (oldestUrl) measuredSizes.delete(oldestUrl);
    }
  }
  return dimensions;
}

export function chatImageFrame(
  dimensions: ChatImageDimensions | null,
  maxWidth: number,
  maxHeight = 320,
): ChatImageFrame {
  const widthLimit = Math.max(1, Math.min(240, maxWidth));
  const heightLimit = Math.max(1, maxHeight);
  const aspect = dimensions ? dimensions.width / dimensions.height : 4 / 3;
  const isExtreme = aspect < 1 / 3 || aspect > 3;
  const displayAspect = Math.max(1 / 3, Math.min(3, aspect));
  const width = Math.min(widthLimit, heightLimit * displayAspect);
  return {
    width,
    height: width / displayAspect,
    contentFit: isExtreme ? "cover" : "contain",
    isExtreme,
  };
}
