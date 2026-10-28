import type { GameState, LevelConfig } from '../types';
import { characterNames } from './theme';

// 复盘只比较真实合成进度；没有共鸣快照时不把未知次数写成零。
export function resultCopy(stage: LevelConfig, state: Pick<GameState, 'highestBallLevel' | 'score'>, won: boolean, afterimageMerges?: number) {
  const actualLevel = Math.max(1, Math.min(characterNames.length - 1, state.highestBallLevel));
  const targetLevel = stage.targetBallLevel ?? actualLevel;
  const levelGap = Math.max(0, targetLevel - actualLevel);
  const required = stage.requiredAfterimageMerges ?? 0;
  let resonance = '';
  let remaining: number | undefined;
  if (required > 0) {
    resonance = `共鸣目标 ${required} 次`;
    if (afterimageMerges !== undefined && Number.isFinite(afterimageMerges)) {
      const count = Math.max(0, Math.floor(afterimageMerges));
      remaining = Math.max(0, required - count);
      resonance = `残影共鸣 ${Math.min(count, required)} / ${required} · 已完成`;
      if (remaining > 0) resonance = `残影共鸣 ${count} / ${required} · 还差 ${remaining} 次`;
    }
  }

  let headline = '换个落点，再试一次';
  let gap = `合成目标还差 ${levelGap} 级`;
  let advice = stage.hint ?? '先找场上的同款搭子，再决定下一球落点';
  let actual = characterNames[actualLevel];
  let target = characterNames[targetLevel];
  if (actualLevel === 1) actual = '尚未合成';
  if (levelGap === 1) {
    headline = '就差一级，下次接上！';
    advice = `先凑两只${characterNames[actualLevel]}，让同款碰在一起`;
  }
  if (levelGap === 0) {
    gap = '目标搭子已合出';
    if (remaining !== undefined && remaining > 0) {
      headline = '搭子到齐，还差共鸣';
      advice = '下次让同款残影靠近共鸣，搭子和共鸣都达标才过关';
    }
  }
  if (!stage.targetBallLevel) {
    actual = `${state.score} 快乐值`;
    target = `${stage.targetScore} 快乐值`;
    gap = `快乐值还差 ${Math.max(0, stage.targetScore - state.score)}`;
  }
  if (won) {
    headline = '全员下班，收工！';
    gap = '本关目标，全部完成';
    advice = '把好心情带回工位，搭子还在等你';
  }
  return { actualLevel, targetLevel, actual, target, headline, gap, resonance, advice };
}
