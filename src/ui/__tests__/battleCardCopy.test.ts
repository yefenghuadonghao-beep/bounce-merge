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
    expect(battleCardCopy(control, classic[7])).toMatchObject({ resource: '8 发 / 1 抱团 / 3 换球', useCase: '点选后两球，或轮换三球', cost: '充能最多奖励 2 次抱团' });
  });
  it('distinguishes classic swap refunds from afterimage core protection', () => {
    expect(battleCardCopy(chain, classic[7]).cost).toBe('换球 -1，首次充能返还');
    expect(battleCardCopy(chain, shadow[3])).toMatchObject({ useCase: '清影留核心，接着做共鸣', resource: '12 发 / 2 抱团 / 1 换球', cost: '充能最多奖励 2 次抱团' });
  });
});
