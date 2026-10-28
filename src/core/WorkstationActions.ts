import type { WorkstationConfig, WorkstationEmployee, WorkstationItem, WorkstationState } from '../types/workstation';

export type WorkstationContent = WorkstationItem | WorkstationEmployee;
export interface WorkstationSource { source: 'inbox' | 'desk'; index: number; content: WorkstationContent }

export function canMergeWorkstationContent(first: WorkstationContent, second: WorkstationContent, config: WorkstationConfig) {
  if (first.id === second.id || first.type !== second.type) return false;
  const firstEmployee = 'producedCoins' in first;
  const secondEmployee = 'producedCoins' in second;
  if (firstEmployee || secondEmployee) return firstEmployee && secondEmployee && first.type !== 'manager';
  if (first.level !== second.level) return false;
  const recipe = config.itemLevels[first.type];
  return first.level < recipe.maxLevel || Boolean(recipe.promotesTo);
}

// 优先整理桌面，再把收件箱同款合到桌面；每次只合一组，不重排玩家布局。
export function findWorkstationMerge(state: WorkstationState, config: WorkstationConfig): { target: number; source: WorkstationSource; prepare?: WorkstationItem } | undefined {
  const desks = state.desks;
  for (let i = 0; i < desks.length; i++) {
    const target = desks[i];
    if (!target.unlocked || !target.content) continue;
    for (let j = i + 1; j < desks.length; j++) {
      const source = desks[j];
      if (source.unlocked && source.content && canMergeWorkstationContent(target.content, source.content, config)) return { target: i, source: { source: 'desk', index: j, content: source.content } as WorkstationSource };
    }
    for (let j = 0; j < state.inbox.length; j++) {
      if (canMergeWorkstationContent(target.content, state.inbox[j], config)) return { target: i, source: { source: 'inbox', index: j, content: state.inbox[j] } as WorkstationSource };
    }
  }
  const empty = desks.findIndex(desk => desk.unlocked && !desk.occupied);
  if (empty >= 0) {
    for (let i = 0; i < state.inbox.length; i++) {
      for (let j = i + 1; j < state.inbox.length; j++) {
        if (canMergeWorkstationContent(state.inbox[i], state.inbox[j], config)) return { target: empty, prepare: state.inbox[i], source: { source: 'inbox', index: j, content: state.inbox[j] } };
      }
    }
  }
  return undefined;
}
