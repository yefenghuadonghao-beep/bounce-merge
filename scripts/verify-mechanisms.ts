import { readFileSync, writeFileSync } from 'node:fs';
import { simulateStage, type PlayActions } from './simulate-chapter';
import levels from '../src/config/levelConfig.json';
import shadows from '../src/config/afterimageLevels.json';
import { battlePlans, battlePlanEffects } from '../src/core/BattlePlan';

const chapter = JSON.parse(readFileSync('scripts/chapter-solutions.json', 'utf8')) as { stage: number; angles: number[]; rescue: boolean }[];
const cards = JSON.parse(readFileSync('scripts/card-plan-solutions.json', 'utf8')) as { stage: number; afterimage: boolean; plan: string; angles: number[]; actions: PlayActions }[];
const routes = [...chapter.map(route => ({ route, shadow: false, plan: '', actions: {} as PlayActions })), ...cards.map(route => ({ route, shadow: route.afterimage, plan: route.plan, actions: route.actions }))];
for (let i = 0; i < routes.length; i++) {
  const entry = routes[i];
  if (simulateStage(entry.route.stage, entry.route.angles, true, entry.shadow, entry.plan, entry.actions).won) continue;
  const plan = battlePlans().find(plan => plan.id === entry.plan);
  const level = (entry.shadow ? shadows : levels)[entry.route.stage - 1];
  const shots = level.shots + battlePlanEffects(plan, level).shots;
  let found = false;
  for (let seed = 1; seed <= 800 && !found; seed++) {
    let value = seed * 2654435761 >>> 0;
    const random = () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
    const angles = Array.from({ length: shots }, () => 0.35 + random() * 2.44);
    const swaps = Array.from({ length: shots }, () => Math.floor(random() * 3));
    const policies: PlayActions[] = entry.plan ? [{}, { swaps }, { swaps, rescueAfterShots: [4, 7] }, { pickSlots: swaps, rescueAfterShots: [4, 7] }] : [{}];
    for (let j = 0; j < policies.length; j++) {
      const result = simulateStage(entry.route.stage, angles, true, entry.shadow, entry.plan, policies[j]);
      if (!result.won || (entry.plan === 'plan_control' && result.swapsUsed === 0)) continue;
      entry.route.angles = angles;
      if ('actions' in entry.route) entry.route.actions = policies[j];
      found = true;
      console.log(JSON.stringify({ stage: entry.route.stage, plan: entry.plan, seed, ...result }));
      break;
    }
  }
  if (!found) throw new Error(`No verified route: ${entry.route.stage} ${entry.plan}`);
}
writeFileSync('scripts/chapter-solutions.json', JSON.stringify(chapter, null, 2) + '\n');
writeFileSync('scripts/card-plan-solutions.json', JSON.stringify(cards, null, 2) + '\n');
