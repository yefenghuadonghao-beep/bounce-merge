import { describe, expect, it } from 'vitest';
import { workstationGrowth } from '../workstationGrowth';
import { WorkstationSystem } from '../../core/WorkstationSystem';
import type { WorkstationConfig } from '../../types/workstation';
import configData from '../../config/workstationConfig.json';

const config = configData as WorkstationConfig;

function system() { return new WorkstationSystem(config, { now: () => 1000 }); }

describe('workstation growth guidance', () => {
  it('counts high-level materials across desks and inbox without changing after a merge', () => {
    const store = system();
    store.addItemToInbox('document', 3);
    store.addItemToInbox('document', 3);
    const before = workstationGrowth(store.getState(), config);
    expect(before.progress).toBe(0.25);
    expect(before.title).toBe('下一位：困困猫');
    store.placeItemOnDesk(store.getState().inbox[0].id, 0);
    store.mergeItemFromInbox(store.getState().inbox[0].id, 0);
    expect(workstationGrowth(store.getState(), config).progress).toBe(before.progress);
  });

  it('shows a full recipe as ready and moves to a new role after recruitment', () => {
    const store = system();
    store.addItemToInbox('document', 5);
    store.addItemToInbox('document', 5);
    expect(workstationGrowth(store.getState(), config).progress).toBe(1);
    store.placeItemOnDesk(store.getState().inbox[0].id, 0);
    store.mergeItemFromInbox(store.getState().inbox[0].id, 0);
    const next = workstationGrowth(store.getState(), config);
    expect(next.title).toBe('下一位：续命蛙');
    expect(next.status).toContain('已入职 1 位 · 产出 10 币/时');
  });

  it.each([
    ['document', '1–3'],
    ['coffee', '4–6'],
    ['package', '7–8']
  ] as const)('points %s materials to the matching classic stages', (type, stages) => {
    const store = system();
    store.addItemToInbox(type, 3);
    expect(workstationGrowth(store.getState(), config).recipe).toContain(`普通 ${stages} 关收集`);
  });

  it('does not count unclaimed rewards or non-recruitment decorations', () => {
    const store = system();
    store.addItemToInbox('plant', 3);
    store.getState().journey = {
      records: {}, recentCompletions: [], pendingRewards: [{ id: 'pending', mode: 'classic', level: 1, firstClear: true, newBest: true, coins: 35, items: [{ type: 'document', level: 5 }] }]
    };
    expect(workstationGrowth(store.getState(), config).progress).toBe(0);
  });
});
