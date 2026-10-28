import { describe, expect, it } from 'vitest';
import { battleCardCopy } from '../battleCardCopy';
import { battlePlans } from '../../core/BattlePlan';
import classic from '../../config/levelConfig.json';
import shadow from '../../config/afterimageLevels.json';

const [supply, control, chain] = battlePlans();

describe('tactical card explanations', () => {
  it('shows the smaller late classic supply bonus and its real total resources', () => {
    expect(battleCardCopy(supply, classic[7])).toMatchObject({ benefit: '多发 1 球', resource: '9 发 / 1 抱团 / 0 换球', cost: '换球 -1，出球顺序要安排好' });
  });
  it('keeps two extra shots on the early and afterimage supply cards', () => {
    expect(battleCardCopy(supply, classic[1]).benefit).toBe('多发 2 球');
    expect(battleCardCopy(supply, shadow[3]).benefit).toBe('多发 2 球');
  });
  it('explains direct queue selection and the late reward cap', () => {
    expect(battleCardCopy(control, classic[7])).toMatchObject({ resource: '8 发 / 1 抱团 / 3 换球', benefit: '换球 +2 · 可点选后两球', cost: '充能最多奖励 2 次抱团' });
  });
  it('distinguishes classic swap refunds from afterimage core protection', () => {
    expect(battleCardCopy(chain, classic[7]).cost).toBe('换球 -1，首次充能返还');
    expect(battleCardCopy(chain, shadow[3])).toMatchObject({ useCase: '清影留核心，接着做共鸣', resource: '12 发 / 2 抱团 / 1 换球', cost: '充能最多奖励 2 次抱团' });
  });
  it('shows exact before and after values, including zero resources', () => {
    expect(battleCardCopy(supply, classic[7]).resources).toEqual([
      { label: '发射', before: 8, after: 9 },
      { label: '抱团', before: 1, after: 1 },
      { label: '换球', before: 1, after: 0 }
    ]);
    expect(battleCardCopy(chain, classic[0]).resources[1]).toEqual({ label: '抱团', before: 0, after: 1 });
  });
  it('does not suggest spending queue swaps on an identical opening', () => {
    expect(battleCardCopy(control, classic[1]).useCase).toBe('开局同款，换球留给后面再用');
    expect(battleCardCopy(control, shadow[2]).useCase).toBe('同款连续发，瞄准同一道残影');
  });
});
