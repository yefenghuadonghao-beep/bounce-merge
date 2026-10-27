export interface Size {
  width: number;
  height: number;
}

/**
 * 计算画布的渲染倍率：游戏逻辑始终是设计分辨率（720×1280），画布像素 = 设计尺寸 × 倍率。
 * 倍率取「FIT 缩放后实际显示的物理像素 / 设计像素」，所以桌面小窗口不会白白放大，
 * 手机高清屏能用满像素；结果按 0.25 取整（保证画布尺寸是整数），限制在 [1, maxScale]。
 */
export function computeRenderScale(devicePixelRatio: number, viewport: Size, design: Size, maxScale = 3): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const fit = viewport.width > 0 && viewport.height > 0 ? Math.min(viewport.width / design.width, viewport.height / design.height) : 1;
  const needed = Math.ceil(fit * dpr * 4 - 1e-9) / 4;
  return Math.min(maxScale, Math.max(1, needed));
}

export interface FillLayout {
  /** 画布像素尺寸（铺满整个窗口，长宽比 = 窗口长宽比）。 */
  canvasWidth: number;
  canvasHeight: number;
  /** 主相机缩放：设计分辨率按 contain 放进画布，多出来的部分是上下或左右留边。 */
  zoom: number;
}

/**
 * 小游戏的主屏 canvas 总是被拉伸到整个屏幕，不能像网页那样用 CSS 做 FIT 留边，
 * 所以画布直接取「窗口逻辑尺寸 × 像素比」，再用相机缩放把 720×1280 居中放进去。
 * 像素比会被压到让设计内容最多放大 maxScale 倍，避免 3x 大屏上画布过大。
 */
export function computeFillLayout(devicePixelRatio: number, viewport: Size, design: Size, maxScale = 3): FillLayout {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const view = viewport.width > 0 && viewport.height > 0 ? viewport : design;
  const fit = Math.min(view.width / design.width, view.height / design.height);
  const pixelRatio = Math.min(dpr, maxScale / fit);
  const canvasWidth = Math.max(1, Math.round(view.width * pixelRatio));
  const canvasHeight = Math.max(1, Math.round(view.height * pixelRatio));
  const zoom = Math.min(canvasWidth / design.width, canvasHeight / design.height);
  return { canvasWidth, canvasHeight, zoom };
}
