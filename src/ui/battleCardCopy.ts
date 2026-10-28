import type { LevelConfig, Upgrade } from '../types';
import { battlePlanEffects } from '../core/BattlePlan';

// 卡面和实际效果共用同一份规则，避免前后期或模式切换后说明失真。
export function battleCardCopy(card: Upgrade, next: LevelConfig) {
  const effects = battlePlanEffects(card, next);
  let benefit = `多发 ${effects.shots} 球`;
  let useCase = '差一点达标？留一手补射';
  let cost = '本关没有额外代价';
  const queue = next.shotSequence ?? [];
  const seeds = next.presetBalls ?? [];
  const obstacles = next.obstacles ?? [];
  const splitBoard = obstacles.some(obstacle => obstacle.y < 900);
  if (next.shots <= 5) useCase = `只有 ${next.shots} 发，补射留给收尾`;
  else if (splitBoard) useCase = '绕行容易打散，多留补射机会';
  if (card.id === 'plan_control') {
    benefit = '换球 +2 · 可点选后两球';
    useCase = '先配成同款，再安排左右落点';
    if (seeds.length > 1) useCase = '按预摆搭子换球，先接得上的';
    if (next.requiredAfterimageMerges) useCase = '同款连续发，瞄准同一道残影';
    if (queue.length >= 3 && queue[0] === queue[1] && queue[0] === queue[2]) useCase = '开局同款，换球留给后面再用';
  }
  if (card.id === 'plan_chain') {
    benefit = '抱团 +1 · 3格充能';
    useCase = next.requiredAfterimageMerges ? '清影留核心，接着做共鸣' : '分散两侧时，把同款拉回中间';
  }
  if (effects.swaps < 0) cost = '换球 -1，出球顺序要安排好';
  if (effects.chargeLimit < 3) cost = '充能最多奖励 2 次抱团';
  if (effects.refundSwapOnCharge) cost = '换球 -1，首次充能返还';
  return {
    benefit,
    useCase,
    cost,
    resources: [
      { label: '发射', before: next.shots, after: next.shots + effects.shots },
      { label: '抱团', before: next.shakes ?? 1, after: (next.shakes ?? 1) + effects.shakes },
      { label: '换球', before: next.swaps ?? 2, after: (next.swaps ?? 2) + effects.swaps }
    ],
    resource: `${next.shots + effects.shots} 发 / ${(next.shakes ?? 1) + effects.shakes} 抱团 / ${(next.swaps ?? 2) + effects.swaps} 换球`
  };
}
