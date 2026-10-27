import { describe, expect, it } from 'vitest';
import { battlePlanEffects, battlePlans } from '../BattlePlan';
import { GameController } from '../GameController';
import { MergeCharge } from '../MergeCharge';
import { ShotQueue } from '../ShotQueue';
import balls from '../../config/ballLevels.json';
import levels from '../../config/levelConfig.json';
import shadows from '../../config/afterimageLevels.json';
import config from '../../config/gameConfig.json';

const plans = battlePlans();

describe('next-level battle plans', () => {
  it('gives early levels useful benefits without penalties', () => {
    for (let i = 0; i < plans.length; i++) {
      const effects = battlePlanEffects(plans[i], levels[1]);
      expect(effects.shots).toBeGreaterThanOrEqual(0);
      expect(effects.shakes).toBeGreaterThanOrEqual(0);
      expect(effects.swaps).toBeGreaterThanOrEqual(0);
    }
  });

  it('introduces three different tradeoffs at classic level five and shadow level three', () => {
    const stages = [levels[4], shadows[2]];
    for (let i = 0; i < stages.length; i++) {
      expect(battlePlanEffects(plans[0], stages[i])).toMatchObject({ shots: 2, shakes: -1 });
      expect(battlePlanEffects(plans[1], stages[i])).toMatchObject({ shots: -1, swaps: 2, rotateQueue: true });
      expect(battlePlanEffects(plans[2], stages[i])).toMatchObject({ shakes: 1, swaps: -1, chargeThreshold: 3 });
    }
  });

  it('activates after advancing, survives retry and expires on the following level', () => {
    const controller = new GameController(balls, levels, config);
    controller.applyUpgrade(plans[0]);
    expect(controller.getGameState().activePlan).toBeUndefined();
    expect(controller.getGameState().shotsRemaining).toBe(levels[0].shots);
    controller.advanceLevel();
    expect(controller.getGameState().shotsRemaining).toBe(levels[1].shots + 2);
    controller.useShot();
    controller.retryLevel();
    expect(controller.getGameState().shotsRemaining).toBe(levels[1].shots + 2);
    expect(controller.getGameState().activePlan?.id).toBe('plan_supply');
    controller.advanceLevel();
    expect(controller.getGameState().activePlan).toBeUndefined();
    expect(controller.getGameState().shotsRemaining).toBe(levels[2].shots);
  });

  it('replaces the previous tactic without stacking resources or losing the new one on retry', () => {
    const controller = new GameController(balls, levels, config);
    for (let i = 0; i < 3; i++) controller.advanceLevel();
    controller.applyUpgrade(plans[0]);
    controller.advanceLevel();
    controller.applyUpgrade(plans[1]);
    controller.advanceLevel();
    expect(controller.getGameState().shotsRemaining).toBe(levels[5].shots - 1);
    controller.retryLevel();
    expect(controller.getGameState().activePlan?.id).toBe('plan_control');
    controller.reset();
    expect(controller.getGameState().activePlan).toBeUndefined();
    expect(controller.getGameState().pendingPlan).toBeUndefined();
  });

  it('rotates the first three balls without duplicating or drawing new balls', () => {
    const queue = new ShotQueue(1, 9, Math.random, [1, 2, 3, 4]);
    queue.rotate();
    expect(queue.peek()).toEqual([2, 3, 1]);
    expect([queue.take(), queue.take(), queue.take(), queue.take()]).toEqual([2, 3, 1, 4]);
  });

  it('earns the first chain rescue in three single merges instead of four', () => {
    const charge = new MergeCharge(battlePlanEffects(plans[2], levels[4]).chargeThreshold);
    expect(charge.add(1)).toBe(false);
    expect(charge.add(1)).toBe(false);
    expect(charge.add(1)).toBe(true);
    expect(charge.rewards).toBe(1);
    for (let i = 0; i < 20; i++) charge.add(3);
    expect(charge.rewards).toBe(3);
  });
});
