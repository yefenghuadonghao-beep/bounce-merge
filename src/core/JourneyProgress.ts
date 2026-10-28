import type { ItemType, WorkstationState } from '../types/workstation';

export type JourneyMode = 'classic' | 'afterimage';

export interface StageCompletion {
  id: string;
  mode: JourneyMode;
  level: number;
  score: number;
  bestCombo: number;
  shotsUsed: number;
}

export interface StageRecord {
  clears: number;
  bestScore: number;
  bestCombo: number;
  fewestShots: number;
}

export interface StageReward {
  id: string;
  mode: JourneyMode;
  level: number;
  firstClear: boolean;
  coins: number;
  items: { type: ItemType; level: number }[];
  newBest: boolean;
}

export interface JourneyState {
  records: Record<string, StageRecord>;
  pendingRewards: StageReward[];
  recentCompletions: StageReward[];
}

export function stageKey(mode: JourneyMode, level: number) {
  return `${mode}:${level}`;
}

export function stageRewardPreview(mode: JourneyMode, level: number) {
  let type: ItemType = 'document';
  let itemLevel = 3;
  if (mode === 'classic') {
    if (level >= 4) type = 'coffee';
    if (level >= 7) {
      type = 'package';
      itemLevel = 4;
    }
  } else {
    if (level >= 2) type = 'coffee';
    if (level >= 3) {
      type = 'package';
      itemLevel = 4;
    }
  }
  return {
    type,
    itemLevel,
    firstClearCount: 2,
    repeatCount: 1,
    firstClearCoins: 30 + level * 5,
    repeatCoins: 8 + level * 2,
    comboBonus: 10
  };
}

// 旧档只补新字段，工位资产和已获得的物品全部保留。
export function ensureJourney(state: WorkstationState): JourneyState {
  state.journey ??= { records: {}, pendingRewards: [], recentCompletions: [] };
  state.journey.recentCompletions ??= [];
  return state.journey;
}

// 只接收已判胜的本关快照；回执、纪录和金币在同一份工位存档内变更。
export function completeJourneyStage(state: WorkstationState, completion: StageCompletion): StageReward {
  const maximum = completion.mode === 'classic' ? 8 : 4;
  if (!completion.id || !['classic', 'afterimage'].includes(completion.mode) || !Number.isInteger(completion.level) || completion.level < 1 || completion.level > maximum) {
    throw new Error('Invalid stage completion');
  }
  const values = [completion.score, completion.bestCombo, completion.shotsUsed];
  if (values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Invalid stage performance');
  const journey = ensureJourney(state);
  const existing = journey.recentCompletions.find(reward => reward.id === completion.id) ?? journey.pendingRewards.find(reward => reward.id === completion.id);
  if (existing) return { ...existing, items: existing.items.map(item => ({ ...item })) };

  const key = stageKey(completion.mode, completion.level);
  const previous = journey.records[key];
  const firstClear = !previous;
  const preview = stageRewardPreview(completion.mode, completion.level);
  const itemCount = firstClear ? preview.firstClearCount : preview.repeatCount;
  let coins = firstClear ? preview.firstClearCoins : preview.repeatCoins;
  if (completion.bestCombo >= 3) coins += preview.comboBonus;
  const reward: StageReward = {
    id: completion.id,
    mode: completion.mode,
    level: completion.level,
    firstClear,
    coins,
    items: Array.from({ length: itemCount }, () => ({ type: preview.type, level: preview.itemLevel })),
    newBest: !previous || completion.score > previous.bestScore || completion.bestCombo > previous.bestCombo || completion.shotsUsed < previous.fewestShots
  };
  journey.records[key] = {
    clears: (previous?.clears ?? 0) + 1,
    bestScore: Math.max(previous?.bestScore ?? 0, completion.score),
    bestCombo: Math.max(previous?.bestCombo ?? 0, completion.bestCombo),
    fewestShots: Math.min(previous?.fewestShots ?? completion.shotsUsed, completion.shotsUsed)
  };
  state.coins += coins;
  journey.pendingRewards.push({ ...reward, items: reward.items.map(item => ({ ...item })) });
  journey.recentCompletions.push({ ...reward, items: reward.items.map(item => ({ ...item })) });
  if (journey.recentCompletions.length > 256) journey.recentCompletions.splice(0, journey.recentCompletions.length - 256);
  return reward;
}
