import { describe, expect, it } from 'vitest';
import { computeRenderScale } from '../renderScale';

const design = { width: 720, height: 1280 };

describe('computeRenderScale', () => {
  it('普通桌面（DPR 1，窗口比设计小）保持 1 倍', () => {
    expect(computeRenderScale(1, { width: 1280, height: 720 }, design)).toBe(1);
  });

  it('iPhone 390×844 @3x：按实际显示像素取 1.75 倍，而不是直接 3 倍', () => {
    // FIT 宽度 390 → 390*3 = 1170 物理像素 / 720 = 1.625 → 向上取 0.25 = 1.75
    expect(computeRenderScale(3, { width: 390, height: 844 }, design)).toBe(1.75);
  });

  it('720×1280 视口 @2x / @3x 正好 2 倍 / 3 倍', () => {
    expect(computeRenderScale(2, { width: 720, height: 1280 }, design)).toBe(2);
    expect(computeRenderScale(3, { width: 720, height: 1280 }, design)).toBe(3);
  });

  it('上限截断，并且结果让画布尺寸是整数', () => {
    expect(computeRenderScale(4, { width: 1440, height: 2560 }, design)).toBe(3);
    expect(computeRenderScale(4, { width: 1440, height: 2560 }, design, 2)).toBe(2);
    const s = computeRenderScale(2.625, { width: 412, height: 915 }, design);
    expect(Number.isInteger(720 * s) && Number.isInteger(1280 * s)).toBe(true);
  });

  it('异常输入退回 1 倍', () => {
    expect(computeRenderScale(NaN, { width: 0, height: 0 }, design)).toBe(1);
    expect(computeRenderScale(0, { width: 390, height: 844 }, design)).toBe(1);
  });
});
