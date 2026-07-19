export type ViewportSize = {
  width: number;
  height: number;
};

export type AnchorRect = {
  left: number;
  top: number;
  bottom: number;
};

export type PopoverPosition = {
  left: number;
  top: number;
  width: number;
};

export function positionPopoverInViewport(
  anchor: AnchorRect,
  viewport: ViewportSize,
  measuredHeight: number,
  preferredWidth = 208,
  margin = 16,
  gap = 8,
): PopoverPosition {
  const width = Math.max(0, Math.min(preferredWidth, viewport.width - margin * 2));
  const maxLeft = Math.max(margin, viewport.width - margin - width);
  const left = Math.min(Math.max(anchor.left, margin), maxLeft);
  const height = Math.max(measuredHeight, 1);
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - height;
  const maxTop = Math.max(margin, viewport.height - margin - height);
  const top = below + height <= viewport.height - margin
    ? below
    : above >= margin
      ? above
      : Math.min(Math.max(below, margin), maxTop);

  return { left, top, width };
}
