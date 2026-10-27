import { describe, expect, it } from 'vitest';
import { simulateStage } from '../../../scripts/simulate-chapter';
import solutions from '../../../scripts/card-plan-solutions.json';
import classic from '../../config/levelConfig.json';
import shadows from '../../config/afterimageLevels.json';
import { battlePlanEffects, battlePlans } from '../BattlePlan';

describe('late-game card combinations', () => {
  it('covers all eighteen combinations of six maps and three cards', () => {
    expect(solutions).toHaveLength(18);
    expect(new Set(solutions.map(s => `${s.afterimage}-${s.stage}-${s.plan}`)).size).toBe(18);
  });
  for (let i = 0; i < solutions.length; i++) {
    const route = solutions[i];
    it(`${route.afterimage ? 'shadow' : 'classic'} ${route.stage}: ${route.plan} has a complete playable route`, () => {
      const level = (route.afterimage ? shadows : classic)[route.stage - 1];
      const plan = battlePlans().find(card => card.id === route.plan);
      const result = simulateStage(route.stage, route.angles, true, route.afterimage, route.plan, route.actions);
      expect(result.won).toBe(true);
      expect(result.shots).toBeLessThanOrEqual(level.shots + battlePlanEffects(plan, level).shots);
      if (route.plan === 'plan_control') expect(result.swapsUsed).toBeGreaterThan(0);
      if (route.afterimage) expect(result.shadowMerges).toBeGreaterThanOrEqual(shadows[route.stage - 1].requiredAfterimageMerges);
    });
  }
});
