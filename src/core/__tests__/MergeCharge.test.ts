import { describe, expect, it } from 'vitest';
import { MergeCharge } from '../MergeCharge';

describe('merge charge rewards', () => {
  it('keeps progress across broken combos and rewards the fourth charge', () => {
    const meter = new MergeCharge();
    expect(meter.add(1)).toBe(false);
    expect(meter.add(1)).toBe(false);
    expect(meter.add(1)).toBe(false);
    expect(meter.add(1)).toBe(true);
    expect(meter.charge).toBe(0);
  });
  it('charges twice from the third consecutive merge, retaining overflow', () => {
    const meter = new MergeCharge();
    meter.add(1);
    meter.add(2);
    expect(meter.add(3)).toBe(true);
    meter.add(1);
    meter.add(1);
    meter.add(1);
    expect(meter.add(4)).toBe(true);
    expect(meter.charge).toBe(1);
  });
  it('caps earned rescues and starts each new stage empty', () => {
    const meter = new MergeCharge();
    let awards = 0;
    for (let i = 0; i < 100; i++) if (meter.add(3)) awards++;
    expect(awards).toBe(3);
    expect(meter.rewards).toBe(3);
    expect(new MergeCharge().charge).toBe(0);
  });
});
