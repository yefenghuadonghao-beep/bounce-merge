import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type Phaser from 'phaser';
import { MainScene } from '../MainScene';
import { GameController } from '../../core/GameController';
import { WorkstationManager } from '../../core/WorkstationManager';
import type { StageReward } from '../../core/JourneyProgress';
import { WebPlatform } from '../../platform/WebPlatform';
import { setPlatform } from '../../platform';
import balls from '../../config/ballLevels.json';
import classic from '../../config/levelConfig.json';
import shadow from '../../config/afterimageLevels.json';
import config from '../../config/gameConfig.json';

vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

const receipt = (id = 'pending-stage'): StageReward => ({
  id, mode: 'classic', level: 1, firstClear: true, coins: 35,
  items: [{ type: 'document', level: 3 }, { type: 'document', level: 3 }], newBest: true
});

describe('victory reward handoff', () => {
  let scene: MainScene;
  let controller: GameController;
  let platform: WebPlatform;
  let manager: WorkstationManager;

  beforeEach(() => {
    localStorage.clear();
    WorkstationManager['instance'] = null;
    platform = new WebPlatform();
    setPlatform(platform);
    manager = WorkstationManager.getInstance(platform);
    controller = new GameController(balls, classic, config);
    scene = new MainScene();
    scene.init({ gameController: controller, gameConfig: config });
    scene.scene = { start: vi.fn() } as unknown as Phaser.Scenes.ScenePlugin;
    scene['renderVictoryReward'] = vi.fn();
  });

  it('saves a real first-clear parcel and stage record before allowing the next choice', async () => {
    controller.useShot();
    controller.processMerge(1, 100);
    scene['continueVictory']();
    expect(scene.scene.start).not.toHaveBeenCalled();
    await scene['saveVictoryReward']();
    const state = (await manager.getSystem()).getState();
    expect(state.journey?.records['classic:1']).toEqual({ clears: 1, bestScore: 25, bestCombo: 1, fewestShots: 1 });
    expect(state.journey?.pendingRewards).toHaveLength(1);
    expect(state.coins).toBe(35);
    expect(scene.scene.start).not.toHaveBeenCalled();
    scene['continueVictory']();
    scene['continueVictory'](true);
    expect(scene.scene.start).toHaveBeenCalledOnce();
    expect(scene.scene.start).toHaveBeenCalledWith('UpgradeScene', expect.objectContaining({ reward: scene['rewardReceipt'], won: true, afterimageMode: false }));
    expect(controller.getGameState().currentLevel).toBe(1);
  });

  it('uses the current stage score, mode and shots instead of earlier run totals', async () => {
    controller.startRun(shadow);
    controller.useShot();
    controller.processMerge(3, 100);
    controller.advanceLevel();
    controller.useShot();
    controller.useShot();
    const result = controller.processMerge(2, 5000);
    scene.init({ gameController: controller, gameConfig: config, afterimageMode: true });
    const complete = vi.spyOn(manager, 'completeStage');
    await scene['saveVictoryReward']();
    expect(complete).toHaveBeenCalledWith({
      id: controller.getCompletionId(), mode: 'afterimage', level: 2,
      score: result.score, bestCombo: 1, shotsUsed: 2
    });
    expect(controller.getGameState().score).toBeGreaterThan(result.score);
    expect((await manager.getSystem()).getState().journey?.records['afterimage:2'].bestScore).toBe(result.score);
  });

  it('blocks repeated save and navigation clicks while a receipt is pending', async () => {
    const pending = deferred<StageReward>();
    const complete = vi.spyOn(manager, 'completeStage').mockReturnValueOnce(pending.promise);
    const saving = scene['saveVictoryReward']();
    await scene['saveVictoryReward']();
    scene['continueVictory']();
    expect(complete).toHaveBeenCalledOnce();
    expect(scene.scene.start).not.toHaveBeenCalled();
    pending.resolve(receipt());
    await saving;
    await scene['saveVictoryReward']();
    scene['continueVictory'](true);
    scene['continueVictory'](true);
    expect(complete).toHaveBeenCalledOnce();
    expect(scene.scene.start).toHaveBeenCalledOnce();
    expect(scene.scene.start).toHaveBeenCalledWith('WorkstationScene', expect.objectContaining({ returnTo: 'UpgradeScene', reward: receipt(), afterimageMode: false }));
  });

  it('retries a failed save with the same completion id and leaves no duplicate rewards', async () => {
    controller.useShot();
    controller.processMerge(1, 100);
    const complete = vi.spyOn(manager, 'completeStage');
    vi.spyOn(platform, 'saveData').mockRejectedValueOnce(new Error('storage unavailable'));
    await scene['saveVictoryReward']();
    expect(scene['renderVictoryReward']).toHaveBeenLastCalledWith('奖励还没保存好，点一下重试', true);
    expect(scene['rewardReceipt']).toBeUndefined();
    expect(scene['rewardSaving']).toBe(false);
    scene['continueVictory']();
    expect(scene.scene.start).not.toHaveBeenCalled();
    await scene['saveVictoryReward']();
    expect(complete.mock.calls[0][0].id).toBe(complete.mock.calls[1][0].id);
    const state = (await manager.getSystem()).getState();
    expect(state.coins).toBe(35);
    expect(state.journey?.records['classic:1'].clears).toBe(1);
    expect(state.journey?.pendingRewards).toHaveLength(1);
    expect(scene['rewardReceipt']).toBeDefined();
  });

  it('keeps an older async receipt from attaching to a restarted scene', async () => {
    const first = deferred<StageReward>();
    const second = deferred<StageReward>();
    vi.spyOn(manager, 'completeStage').mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const firstSave = scene['saveVictoryReward']();
    controller.retryLevel();
    scene.init({ gameController: controller, gameConfig: config });
    const secondSave = scene['saveVictoryReward']();
    first.resolve(receipt('old-attempt'));
    await firstSave;
    expect(scene['rewardReceipt']).toBeUndefined();
    expect(scene['rewardSaving']).toBe(true);
    expect(scene['renderVictoryReward']).toHaveBeenCalledTimes(2);
    second.resolve(receipt('new-attempt'));
    await secondSave;
    expect(scene['rewardReceipt']?.id).toBe('new-attempt');
    expect(scene['rewardSaving']).toBe(false);
  });

  it('does not render a completed save after the original scene shuts down', async () => {
    const pending = deferred<StageReward>();
    vi.spyOn(manager, 'completeStage').mockReturnValueOnce(pending.promise);
    const world = new EventEmitter();
    scene.matter = { world } as unknown as Phaser.Physics.Matter.MatterPhysics;
    scene.events = new EventEmitter() as unknown as Phaser.Events.EventEmitter;
    scene['setupCollisions']();
    const saving = scene['saveVictoryReward']();
    scene.events.emit('shutdown');
    pending.resolve(receipt());
    await saving;
    expect(scene['renderVictoryReward']).toHaveBeenCalledOnce();
    expect(scene['rewardReceipt']).toBeUndefined();
    expect(scene.scene.start).not.toHaveBeenCalled();
  });

  it('routes the chapter end to its report or workstation without a ninth stage', async () => {
    for (let i = 1; i < 8; i++) controller.advanceLevel();
    scene.init({ gameController: controller, gameConfig: config });
    scene['rewardReceipt'] = { ...receipt(), level: 8 };
    scene['continueVictory']();
    expect(scene.scene.start).toHaveBeenCalledWith('GameOverScene', expect.objectContaining({ won: true, reward: expect.objectContaining({ level: 8 }) }));
    expect(controller.getGameState().currentLevel).toBe(8);
    scene.init({ gameController: controller, gameConfig: config });
    scene['rewardReceipt'] = { ...receipt(), level: 8 };
    scene['continueVictory'](true);
    expect(scene.scene.start).toHaveBeenLastCalledWith('WorkstationScene', expect.objectContaining({ returnTo: undefined }));
  });
});
