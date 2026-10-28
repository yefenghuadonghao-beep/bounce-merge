import { describe, expect, it } from 'vitest';
import { resultCopy } from '../resultCopy';
import type { LevelConfig } from '../../types';

const stage: LevelConfig = { level: 8, targetScore: 0, targetBallLevel: 6, shots: 8, hint: '先看落点，再分两路合成' };

describe('result progress copy', () => {
  it('compares this stage with its actual goal and explains a one-level gap', () => {
    const copy = resultCopy(stage, { highestBallLevel: 5, score: 800 }, false);
    expect(copy).toMatchObject({ actual: '打卡汪', target: '发呆兔', gap: '合成目标还差 1 级', headline: '就差一级，下次接上！' });
    expect(copy.advice).toContain('两只打卡汪');
  });

  it('does not pretend that the initial ball is an achieved merge', () => {
    const copy = resultCopy(stage, { highestBallLevel: 1, score: 0 }, false);
    expect(copy.actual).toBe('尚未合成');
    expect(copy.gap).toBe('合成目标还差 5 级');
    expect(copy.advice).toBe(stage.hint);
  });

  it('identifies missing resonance even when the target character is complete', () => {
    const copy = resultCopy({ ...stage, requiredAfterimageMerges: 4 }, { highestBallLevel: 6, score: 800 }, false, 2);
    expect(copy.gap).toBe('目标搭子已合出');
    expect(copy.headline).toBe('搭子到齐，还差共鸣');
    expect(copy.resonance).toBe('残影共鸣 2 / 4 · 还差 2 次');
    expect(copy.advice).toContain('同款残影');
  });

  it('keeps both goals independent and caps only the displayed completed resonance', () => {
    const copy = resultCopy({ ...stage, requiredAfterimageMerges: 4 }, { highestBallLevel: 5, score: 800 }, false, 6);
    expect(copy.gap).toBe('合成目标还差 1 级');
    expect(copy.resonance).toBe('残影共鸣 4 / 4 · 已完成');
  });

  it('distinguishes unknown resonance from a real zero', () => {
    const shadow = { ...stage, requiredAfterimageMerges: 4 };
    const state = { highestBallLevel: 5, score: 800 };
    expect(resultCopy(shadow, state, false).resonance).toBe('共鸣目标 4 次');
    expect(resultCopy(shadow, state, false, Number.NaN).resonance).toBe('共鸣目标 4 次');
    expect(resultCopy(shadow, state, false, 0).resonance).toBe('残影共鸣 0 / 4 · 还差 4 次');
  });

  it('supports score goals and does not report a negative deficit', () => {
    const scoreStage = { level: 1, shots: 5, targetScore: 100 };
    expect(resultCopy(scoreStage, { highestBallLevel: 2, score: 60 }, false)).toMatchObject({ actual: '60 快乐值', target: '100 快乐值', gap: '快乐值还差 40' });
    expect(resultCopy(stage, { highestBallLevel: 7, score: 800 }, true).gap).toBe('本关目标，全部完成');
  });
});
