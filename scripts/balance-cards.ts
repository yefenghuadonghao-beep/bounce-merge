import { writeFileSync } from 'node:fs';
import { simulateStage, PlayActions } from './simulate-chapter';
import { battlePlanEffects, battlePlans } from '../src/core/BattlePlan';
import classic from '../src/config/levelConfig.json';
import shadows from '../src/config/afterimageLevels.json';

// 同一弹道种子试四种操作：原队列、轮换、中途救场、直接选球。每张卡使用相同候选预算。
const cases = [...[5, 6, 7, 8].map(stage => ({ stage, afterimage: false })), ...[3, 4].map(stage => ({ stage, afterimage: true }))];
const selectedCases = cases.filter(entry => !process.env.BALANCE_CASE || `${entry.afterimage ? 'shadow' : 'classic'}-${entry.stage}` === process.env.BALANCE_CASE);
const seeds = Number(process.env.BALANCE_SEEDS ?? 100);
const firstSeed = Number(process.env.BALANCE_FIRST_SEED ?? 1);
const results = [];
for (let c = 0; c < selectedCases.length; c++) {
  const { stage, afterimage } = selectedCases[c];
  const level = (afterimage ? shadows : classic)[stage - 1];
  const plans = [undefined, ...battlePlans()];
  for (let p = 0; p < plans.length; p++) {
    const plan = plans[p];
    const shots = level.shots + battlePlanEffects(plan, level).shots;
    let wins = 0;
    let noActionWins = 0;
    let toolWins = 0;
    let firstWin: { angles: number[]; actions: PlayActions; result: ReturnType<typeof simulateStage> } | undefined;
    const winningSeeds = [];
    for (let seed = firstSeed; seed < firstSeed + seeds; seed++) {
      let value = (seed * 2654435761) >>> 0;
      const random = () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
      // 统一生成 16 发后截取，避免球数变化同时改变换球策略的随机来源。
      const fullAngles = Array.from({ length: 16 }, () => 0.35 + random() * 2.44);
      const swaps = Array.from({ length: 16 }, () => Math.floor(random() * 3));
      const angles = fullAngles.slice(0, shots);
      const policies: PlayActions[] = [{}, { swaps }, { swaps, rescueAfterShots: [4, 7] }, { pickSlots: swaps, rescueAfterShots: [4, 7] }];
      let won = false;
      for (let policy = 0; policy < policies.length; policy++) {
        const result = simulateStage(stage, angles, true, afterimage, plan?.id ?? '', policies[policy]);
        if (!result.won) continue;
        if (policy === 0) noActionWins++;
        if (result.swapsUsed > 0 || result.rescues > 0) toolWins++;
        if (!firstWin || (plan?.id === 'plan_control' && result.swapsUsed > 0 && !firstWin.result.swapsUsed)) {
          firstWin = { angles, actions: policies[policy], result };
        }
        won = true;
      }
      if (won) { wins++; winningSeeds.push(seed); }
    }
    const row = { stage, afterimage, plan: plan?.id ?? 'none', firstSeed, seeds, wins, noActionWins, toolWins, winningSeeds, firstWin };
    results.push(row);
    console.log(JSON.stringify({ stage, afterimage, plan: row.plan, wins, noActionWins, toolWins }));
  }
}
writeFileSync(process.env.BALANCE_OUT ?? '/tmp/card-balance.json', JSON.stringify(results, null, 2));
