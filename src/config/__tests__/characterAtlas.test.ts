import { describe, expect, it } from 'vitest';
import characterAtlas from '../characterAtlas.json';
import ballLevels from '../ballLevels.json';

describe('characterAtlas', () => {
  const frames = characterAtlas.frames as Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  const { w, h } = characterAtlas.meta.size;

  it('每个等级都有对应的正方形帧', () => {
    const levels = (ballLevels as { level: number }[]).map(entry => entry.level);
    for (const level of levels) {
      const frame = frames[`ball_${level}`]?.frame;
      expect(frame, `ball_${level}`).toBeDefined();
      expect(frame.w).toBe(frame.h);
    }
  });

  it('帧都在图集范围内且互不重叠', () => {
    const rects = Object.values(frames).map(entry => entry.frame);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(w);
      expect(r.y + r.h).toBeLessThanOrEqual(h);
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    }
  });
});
