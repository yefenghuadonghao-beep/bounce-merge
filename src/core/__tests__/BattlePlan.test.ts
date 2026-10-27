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
    expect(battlePlanEffects(plans[0], levels[4])).toMatchObject({ shots: 1, swaps: -1, shakes: 0 });
    expect(battlePlanEffects(plans[0], shadows[2])).toMatchObject({ shots: 2, swaps: -1, shakes: 0 });
    expect(battlePlanEffects(plans[1], levels[4])).toMatchObject({ shots: 0, swaps: 2, rotateQueue: true, chargeLimit: 2 });
    expect(battlePlanEffects(plans[2], levels[4])).toMatchObject({ shakes: 1, swaps: -1, chargeThreshold: 3, preserveCores: true, refundSwapOnCharge: true });
    expect(battlePlanEffects(plans[2], shadows[2])).toMatchObject({ shakes: 1, swaps: 0, chargeThreshold: 3, chargeLimit: 2, preserveCores: true, refundSwapOnCharge: false });
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
    expect(controller.getGameState().shotsRemaining).toBe(levels[5].shots);
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
  it('can directly choose either preview ball without destroying the original queue', () => {
    const queue = new ShotQueue(1, 9, Math.random, [1, 2, 3, 4]);
    queue.swap(2);
    expect(queue.peek()).toEqual([3, 2, 1]);
    queue.swap(1);
    expect(queue.peek()).toEqual([2, 3, 1]);
    expect([queue.take(), queue.take(), queue.take(), queue.take()]).toEqual([2, 3, 1, 4]);
  });

  it('caps the control plan at two charge rewards without reducing its initial shots or rescues', () => {
    const effects = battlePlanEffects(plans[1], levels[7]);
    const charge = new MergeCharge(effects.chargeThreshold, effects.chargeLimit);
    for (let i = 0; i < 30; i++) charge.add(3);
    expect(charge.rewards).toBe(2);
    expect(effects.shots).toBe(0);
    expect(effects.shakes).toBe(0);
  });

});
