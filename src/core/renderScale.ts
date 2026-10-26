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
