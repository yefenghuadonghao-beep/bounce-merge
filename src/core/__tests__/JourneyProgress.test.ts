import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkstationManager } from '../WorkstationManager';
import { stageRewardPreview, stageKey, type StageCompletion } from '../JourneyProgress';
import { WebPlatform } from '../../platform/WebPlatform';

const completion = (overrides: Partial<StageCompletion> = {}): StageCompletion => ({
  id: 'attempt-1', mode: 'classic', level: 1, score: 25, bestCombo: 1, shotsUsed: 1, ...overrides
});

beforeEach(() => {
  localStorage.clear();
  WorkstationManager['instance'] = null;
});

describe('journey rewards and records', () => {
  it('previews deterministic useful pairs and later-tier materials', () => {
    expect(stageRewardPreview('classic', 1)).toMatchObject({ type: 'document', itemLevel: 3, firstClearCount: 2, repeatCount: 1, firstClearCoins: 35, repeatCoins: 10 });
    expect(stageRewardPreview('classic', 4)).toMatchObject({ type: 'coffee', itemLevel: 3 });
    expect(stageRewardPreview('classic', 8)).toMatchObject({ type: 'package', itemLevel: 4 });
    expect(stageRewardPreview('afterimage', 2)).toMatchObject({ type: 'coffee', itemLevel: 3 });
    expect(stageRewardPreview('afterimage', 3)).toMatchObject({ type: 'package', itemLevel: 4 });
  });

  it('awards first-clear items to a pending parcel and coins immediately', async () => {
    const manager = WorkstationManager.getInstance(new WebPlatform());
    const reward = await manager.completeStage(completion());
    const state = (await manager.getSystem()).getState();
    expect(reward).toMatchObject({ firstClear: true, newBest: true, coins: 35 });
    expect(reward.items).toEqual([{ type: 'document', level: 3 }, { type: 'document', level: 3 }]);
    expect(state.coins).toBe(35);
    expect(state.inbox).toHaveLength(3);
    expect(state.journey?.pendingRewards).toHaveLength(1);
    expect(state.journey?.records[stageKey('classic', 1)]).toEqual({ clears: 1, bestScore: 25, bestCombo: 1, fewestShots: 1 });
  });

  it('keeps mode records independent, improves bests without lowering old values', async () => {
    const manager = WorkstationManager.getInstance(new WebPlatform());
    await manager.completeStage(completion({ score: 100, bestCombo: 2, shotsUsed: 3 }));
    const replay = await manager.completeStage(completion({ id: 'attempt-2', score: 70, bestCombo: 1, shotsUsed: 4 }));
    expect(replay).toMatchObject({ firstClear: false, newBest: false, coins: 10 });
    expect(replay.items).toHaveLength(1);
    const improved = await manager.completeStage(completion({ id: 'attempt-3', score: 120, bestCombo: 3, shotsUsed: 2 }));
    expect(improved).toMatchObject({ firstClear: false, newBest: true, coins: 20 });
    await manager.completeStage(completion({ id: 'shadow-1', mode: 'afterimage', score: 90 }));
    const records = (await manager.getSystem()).getState().journey?.records;
    expect(records?.['classic:1']).toEqual({ clears: 3, bestScore: 120, bestCombo: 3, fewestShots: 2 });
    expect(records?.['afterimage:1']).toEqual({ clears: 1, bestScore: 90, bestCombo: 1, fewestShots: 1 });
  });

  it('loads only once and serializes concurrent duplicate completions and claims', async () => {
    const platform = new WebPlatform();
    const load = vi.spyOn(platform, 'loadData');
    const manager = WorkstationManager.getInstance(platform);
    const [first, second] = await Promise.all([manager.getSystem(), manager.getSystem()]);
    expect(first).toBe(second);
    expect(load).toHaveBeenCalledOnce();
    const rewards = await Promise.all([manager.completeStage(completion()), manager.completeStage(completion())]);
    expect(rewards[0]).toEqual(rewards[1]);
    const claims = await Promise.all([manager.claimStageRewards(), manager.claimStageRewards()]);
    expect(claims).toEqual([{ claimed: 2, remaining: 0 }, { claimed: 0, remaining: 0 }]);
    expect(first.getState().coins).toBe(35);
    expect(first.getState().inbox).toHaveLength(5);
    expect(first.getState().journey?.records['classic:1'].clears).toBe(1);
  });

  it('retains overflow parcels across reloads and cannot repay claimed completions', async () => {
    const platform = new WebPlatform();
    let manager = WorkstationManager.getInstance(platform);
    const system = await manager.getSystem();
    while (system.getState().inbox.length < 19) system.addItemToInbox('coffee', 1);
    const original = await manager.completeStage(completion());
    expect(await manager.claimStageRewards()).toEqual({ claimed: 1, remaining: 1 });
    expect(original.items).toHaveLength(2);
    WorkstationManager['instance'] = null;
    manager = WorkstationManager.getInstance(platform);
    const restored = await manager.getSystem();
    expect(restored.getState().inbox).toHaveLength(20);
    expect(restored.getState().journey?.pendingRewards[0].items).toHaveLength(1);
    expect(await manager.claimStageRewards()).toEqual({ claimed: 0, remaining: 1 });
    restored.placeItemOnDesk(restored.getState().inbox[0].id, 0);
    expect(await manager.claimStageRewards()).toEqual({ claimed: 1, remaining: 0 });
    expect(await manager.completeStage(completion())).toEqual(original);
    expect(restored.getState().journey?.pendingRewards).toEqual([]);
    expect(restored.getState().coins).toBe(35);
    expect(restored.getState().journey?.records['classic:1'].clears).toBe(1);
  });

  it('adds empty progress to old saves without inventing clears or changing assets', async () => {
    const platform = new WebPlatform();
    let manager = WorkstationManager.getInstance(platform);
    const system = await manager.getSystem();
    system.getState().coins = 88;
    system.placeItemOnDesk(system.getState().inbox[0].id, 0);
    delete system.getState().journey;
    await manager.save();
    WorkstationManager['instance'] = null;
    manager = WorkstationManager.getInstance(platform);
    const state = (await manager.getSystem()).getState();
    expect(state.coins).toBe(88);
    expect(state.inbox).toHaveLength(2);
    expect(state.desks[0].content).toMatchObject({ type: 'document', level: 1 });
    expect(state.journey).toEqual({ records: {}, pendingRewards: [], recentCompletions: [] });
  });

  it('rolls back a rejected save so retry awards and claims each item once', async () => {
    const platform = new WebPlatform();
    const manager = WorkstationManager.getInstance(platform);
    const system = await manager.getSystem();
    vi.spyOn(platform, 'saveData').mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(manager.completeStage(completion())).rejects.toThrow('storage unavailable');
    expect(system.getState().coins).toBe(0);
    expect(system.getState().journey?.records).toEqual({});
    await manager.completeStage(completion());
    vi.spyOn(platform, 'saveData').mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(manager.claimStageRewards()).rejects.toThrow('storage unavailable');
    expect(system.getState().inbox).toHaveLength(3);
    expect(system.getState().journey?.pendingRewards[0].items).toHaveLength(2);
    expect(await manager.claimStageRewards()).toEqual({ claimed: 2, remaining: 0 });
  });

  it('keeps sequential saves from overwriting a later completion', async () => {
    const platform = new WebPlatform();
    const manager = WorkstationManager.getInstance(platform);
    await Promise.all([
      manager.completeStage(completion()),
      manager.save(),
      manager.completeStage(completion({ id: 'attempt-2', level: 2 }))
    ]);
    WorkstationManager['instance'] = null;
    const restored = (await WorkstationManager.getInstance(platform).getSystem()).getState();
    expect(restored.coins).toBe(75);
    expect(Object.keys(restored.journey?.records ?? {})).toEqual(['classic:1', 'classic:2']);
    expect(restored.journey?.pendingRewards).toHaveLength(2);
  });

  it('preserves both claims and records when completing, saving and claiming together', async () => {
    const platform = new WebPlatform();
    const manager = WorkstationManager.getInstance(platform);
    const tasks = await Promise.all([
      manager.completeStage(completion()),
      manager.claimStageRewards(),
      manager.completeStage(completion({ id: 'attempt-2', level: 2 })),
      manager.save(),
      manager.claimStageRewards()
    ]);
    expect(tasks[1]).toEqual({ claimed: 2, remaining: 0 });
    expect(tasks[4]).toEqual({ claimed: 2, remaining: 0 });
    WorkstationManager['instance'] = null;
    const state = (await WorkstationManager.getInstance(platform).getSystem()).getState();
    expect(state.inbox).toHaveLength(7);
    expect(state.coins).toBe(75);
    expect(state.journey?.pendingRewards).toEqual([]);
    expect(Object.keys(state.journey?.records ?? {})).toHaveLength(2);
  });

  it('does not mutate stored rewards when a caller modifies its receipt', async () => {
    const manager = WorkstationManager.getInstance(new WebPlatform());
    const reward = await manager.completeStage(completion());
    reward.items[0].level = 1;
    reward.items.pop();
    const pending = (await manager.getSystem()).getState().journey?.pendingRewards;
    expect(pending?.[0].items).toEqual([{ type: 'document', level: 3 }, { type: 'document', level: 3 }]);
    expect((await manager.completeStage(completion())).items).toHaveLength(2);
  });

  it('does not overwrite a malformed stored save with starter assets', async () => {
    const platform = new WebPlatform();
    await platform.saveData('workstation_state', '{broken-save');
    const manager = WorkstationManager.getInstance(platform);
    await expect(manager.completeStage(completion())).rejects.toThrow();
    expect(await platform.loadData('workstation_state')).toBe('{broken-save');
  });

  it('rejects invalid performance without writing progress', async () => {
    const manager = WorkstationManager.getInstance(new WebPlatform());
    await expect(manager.completeStage(completion({ score: Number.NaN }))).rejects.toThrow('Invalid stage performance');
    await expect(manager.completeStage(completion({ level: 9 }))).rejects.toThrow('Invalid stage completion');
    const state = (await manager.getSystem()).getState();
    expect(state.coins).toBe(0);
    expect(state.journey?.records).toEqual({});
  });

  it('turns five early victories into a real employee and seventh desk that survive reload', async () => {
    const platform = new WebPlatform();
    vi.spyOn(platform, 'getCurrentTime').mockReturnValue(1000);
    const manager = WorkstationManager.getInstance(platform);
    const stages = [1, 2, 3, 1, 2];
    for (let i = 0; i < stages.length; i++) {
      await manager.completeStage(completion({ id: `growth-${i}`, level: stages[i] }));
    }
    expect(await manager.claimStageRewards()).toEqual({ claimed: 8, remaining: 0 });
    const system = await manager.getSystem();
    const state = system.getState();
    expect(state.inbox.filter(item => item.type === 'document' && item.level === 3)).toHaveLength(8);
    expect(state.coins).toBe(142);

    // 每两份三级文件合成四级，再依照真实合成规则逐级招募员工。
    function mergePairOnDesk(desk: number) {
      const first = state.inbox.find(item => item.type === 'document' && item.level === 3)!;
      expect(system.placeItemOnDesk(first.id, desk)).toBe(true);
      const second = state.inbox.find(item => item.type === 'document' && item.level === 3)!;
      expect(system.mergeItemFromInbox(second.id, desk)).toBe(true);
      expect(state.desks[desk].content).toMatchObject({ type: 'document', level: 4 });
    }
    mergePairOnDesk(0);
    mergePairOnDesk(1);
    expect(system.mergeItems(0, 1)).toBe(true);
    expect(state.desks[0].content).toMatchObject({ type: 'document', level: 5 });
    mergePairOnDesk(1);
    mergePairOnDesk(2);
    expect(system.mergeItems(1, 2)).toBe(true);
    expect(system.mergeItems(0, 1)).toBe(true);
    expect(state.desks[0].content).toMatchObject({ type: 'intern', producedCoins: 0 });
    expect(state.totalMerges).toBe(7);
    const employeeId = state.desks[0].content!.id;
    expect(system.unlockDesk()).toBe(true);
    expect(state.desks[6].unlocked).toBe(true);
    expect(state.coins).toBe(42);
    await manager.save();

    WorkstationManager['instance'] = null;
    const restored = (await WorkstationManager.getInstance(platform).getSystem()).getState();
    expect(restored.desks[0].content).toMatchObject({ id: employeeId, type: 'intern' });
    expect(restored.desks.filter(desk => desk.unlocked)).toHaveLength(7);
    expect(restored.coins).toBe(42);
    expect(restored.inbox).toHaveLength(3);
    expect(restored.journey?.pendingRewards).toEqual([]);
    expect(restored.journey?.records).toEqual({
      'classic:1': { clears: 2, bestScore: 25, bestCombo: 1, fewestShots: 1 },
      'classic:2': { clears: 2, bestScore: 25, bestCombo: 1, fewestShots: 1 },
      'classic:3': { clears: 1, bestScore: 25, bestCombo: 1, fewestShots: 1 }
    });
  });
});
