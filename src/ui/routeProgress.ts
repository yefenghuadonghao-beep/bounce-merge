import type { LevelConfig } from '../types';
import { stageKey, type JourneyMode, type StageRecord } from '../core/JourneyProgress';

// 只统计当前路线里的实际通关记录，自由跳关不会把前面的节点自动盖章。
export function routeProgress(mode: JourneyMode, levels: Pick<LevelConfig, 'level'>[], records: Record<string, StageRecord>) {
  let cleared = 0;
  let nextIndex = -1;
  for (let i = 0; i < levels.length; i++) {
    if ((records[stageKey(mode, levels[i].level)]?.clears ?? 0) > 0) cleared++;
    else if (nextIndex === -1) nextIndex = i;
  }
  return { cleared, nextIndex: Math.max(0, nextIndex), complete: cleared === levels.length };
}
