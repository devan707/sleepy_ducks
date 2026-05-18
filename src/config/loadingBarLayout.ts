/** Pixel layout inside `public/assets/ui/loading.png` (768×768). */
export const LOADING_BAR_ART = {
  sourceSize: 768,
  /** On-screen width of the square art asset. */
  displayWidth: 340,
  /** Transparent pill interior (measured on asset). */
  fillRect: {
    x: 252,
    y: 358,
    width: 432,
    height: 84,
  },
  /** Insets inside the white pill stroke. */
  fillInset: {
    left: 0,
    right: 4,
    top: 9,
    bottom: 9,
  },
} as const;

export function getLoadingBarFillMetrics(displayWidth = LOADING_BAR_ART.displayWidth): {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
} {
  const scale = displayWidth / LOADING_BAR_ART.sourceSize;
  const { fillRect, fillInset } = LOADING_BAR_ART;
  const width = (fillRect.width - fillInset.left - fillInset.right) * scale;
  const height = (fillRect.height - fillInset.top - fillInset.bottom) * scale;
  const left =
    -displayWidth / 2 + (fillRect.x + fillInset.left) * scale;
  const top =
    -displayWidth / 2 + (fillRect.y + fillInset.top) * scale;
  return {
    left,
    top,
    width,
    height,
    radius: height / 2,
  };
}
