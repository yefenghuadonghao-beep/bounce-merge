import { LevelConfig, Upgrade } from '../types';
import cards from '../config/upgrades.json';

export function battlePlanEffects(plan: Upgrade | undefined, level: LevelConfig) {
  const shadow = Boolean(level.requiredAfterimageMerges);
  const late = shadow ? level.level >= 3 : level.level >= 5;
  const effects = { shots: 0, shakes: 0, swaps: 0, chargeThreshold: 4, rotateQueue: false, preserveCores: false, chargeLimit: 3, refundSwapOnCharge: false };
  if (plan?.id === 'plan_supply') {
    effects.shots = late && !shadow ? 1 : 2;
    effects.swaps = late ? -Math.min(1, level.swaps ?? 2) : 0;
  }
  if (plan?.id === 'plan_control') {
    effects.swaps = 2;
    effects.rotateQueue = true;
    effects.chargeLimit = late ? 2 : 3;
  }
  if (plan?.id === 'plan_chain') {
    effects.shakes = 1;
    effects.chargeThreshold = 3;
    effects.preserveCores = true;
    effects.refundSwapOnCharge = late && !shadow;
    effects.swaps = late && !shadow ? -Math.min(1, level.swaps ?? 2) : 0;
    if (late && shadow) effects.chargeLimit = 2;
  }
  return effects;
}

// 每轮重新发三张卡，效果只持续下一关，不累积永久资源。
export function battlePlans(): Upgrade[] {
  return cards.map(card => ({ ...card, type: card.type as Upgrade['type'], scope: 'next_level' }));
}
