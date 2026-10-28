import type { LevelConfig, Upgrade } from '../types';
import { battlePlanEffects } from '../core/BattlePlan';

// 卡面和实际效果共用同一份规则，避免前后期或模式切换后说明失真。
export function battleCardCopy(card: Upgrade, next: LevelConfig) {
  const effects = battlePlanEffects(card, next);
  let benefit = `多发 ${effects.shots} 球`;
  let useCase = '差一点达标？留一手补射';
  let cost = '本关没有额外代价';
  if (card.id === 'plan_control') {
    benefit = '换球 +2 · 自己排顺序';
    useCase = '点选后两球，或轮换三球';
  }
  if (card.id === 'plan_chain') {
    benefit = '抱团 +1 · 3格充能';
    useCase = next.requiredAfterimageMerges ? '清影留核心，接着做共鸣' : '球散开了？聚拢再合一次';
  }
  if (effects.swaps < 0) cost = '换球 -1，出球顺序要安排好';
  if (effects.chargeLimit < 3) cost = '充能最多奖励 2 次抱团';
  if (effects.refundSwapOnCharge) cost = '换球 -1，首次充能返还';
  return {
    benefit,
    useCase,
    cost,
    resource: `${next.shots + effects.shots} 发 / ${(next.shakes ?? 1) + effects.shakes} 抱团 / ${(next.swaps ?? 2) + effects.swaps} 换球`
  };
}
