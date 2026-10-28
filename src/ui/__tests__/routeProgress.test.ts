import { describe, expect, it } from 'vitest';
import { routeProgress } from '../routeProgress';

const record = { clears: 1, bestScore: 200, bestCombo: 3, fewestShots: 2 };
const levels = [{ level: 1 }, { level: 2 }, { level: 3 }];

describe('route progress', () => {
  it('does not fill skipped stages or mix classic and afterimage records', () => {
    const records = { 'classic:3': record, 'afterimage:1': record, 'classic:99': record };
    expect(routeProgress('classic', levels, records)).toEqual({ cleared: 1, nextIndex: 0, complete: false });
    expect(routeProgress('afterimage', levels, records)).toEqual({ cleared: 1, nextIndex: 1, complete: false });
  });

  it('continues at the first unfinished stage and only completes with every stamp', () => {
    const records = { 'classic:1': record, 'classic:2': { ...record, clears: 0 }, 'classic:3': record };
    expect(routeProgress('classic', levels, records)).toEqual({ cleared: 2, nextIndex: 1, complete: false });
    records['classic:2'].clears = 1;
    expect(routeProgress('classic', levels, records)).toEqual({ cleared: 3, nextIndex: 0, complete: true });
  });

  it('keeps an old save with no records at the first stage', () => {
    expect(routeProgress('classic', levels, {})).toEqual({ cleared: 0, nextIndex: 0, complete: false });
  });
});
