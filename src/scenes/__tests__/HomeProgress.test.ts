import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { HomeScene } from '../HomeScene';
import { WorkstationManager } from '../../core/WorkstationManager';
import type { WorkstationSystem } from '../../core/WorkstationSystem';
import { GameController } from '../../core/GameController';
import { setPlatform } from '../../platform';
import { WebPlatform } from '../../platform/WebPlatform';
import ballLevels from '../../config/ballLevels.json';
import levelConfigs from '../../config/levelConfig.json';
import config from '../../config/gameConfig.json';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));

const stored = { coins: 130, journey: { records: { 'classic:1': { clears: 1, bestScore: 25, bestCombo: 1, fewestShots: 1 } }, pendingRewards: [{ items: [{ type: 'document', level: 3 }, { type: 'document', level: 3 }] }] } };
const system = { getState: () => stored } as unknown as WorkstationSystem;

describe('home progress loading', () => {
  let home: HomeScene;
  let controller: GameController;
  beforeEach(() => {
    vi.restoreAllMocks();
    setPlatform(new WebPlatform());
    controller = new GameController(ballLevels, levelConfigs, config);
    home = new HomeScene();
    home.init({ gameController: controller, gameConfig: config });
  });

  it('does not apply an older asynchronous read after scene reentry', async () => {
    let resolve!: (value: WorkstationSystem) => void;
    const pending = new Promise<WorkstationSystem>(done => { resolve = done; });
    vi.spyOn(WorkstationManager, 'getInstance').mockReturnValue({ getSystem: () => pending } as unknown as WorkstationManager);
    const task = home['loadProgress'](home['viewVersion']);
    home.init({ gameController: controller, gameConfig: config });
    resolve(system);
    await task;
    expect(home['records']).toEqual({});
    expect(home['progressLoaded']).toBe(false);
  });

  it('displays recorded stamps and actual unclaimed item count after loading', async () => {
    vi.spyOn(WorkstationManager, 'getInstance').mockReturnValue({ getSystem: async () => system } as unknown as WorkstationManager);
    const title = { setText: vi.fn().mockReturnThis() };
    const inbox = { setText: vi.fn().mockReturnThis(), setColor: vi.fn().mockReturnThis() };
    const balance = { setText: vi.fn().mockReturnThis() };
    const next = { setText: vi.fn().mockReturnThis() };
    home['homeProgress'] = title as unknown as Phaser.GameObjects.Text;
    home['workstationProgress'] = inbox as unknown as Phaser.GameObjects.Text;
    home['coinBalance'] = balance as unknown as Phaser.GameObjects.Text;
    home['nextStageText'] = next as unknown as Phaser.GameObjects.Text;
    await home['loadProgress'](home['viewVersion']);
    expect(title.setText).toHaveBeenCalledWith('已完成 1 / 8');
    expect(inbox.setText).toHaveBeenCalledWith('2 件通关物资待领取');
    expect(balance.setText).toHaveBeenCalledWith('130');
    expect(next.setText).toHaveBeenCalledWith(`下一站 02 · ${levelConfigs[1].title}`);
  });

  it('keeps navigation usable after a storage failure and ignores repeated start presses', async () => {
    vi.spyOn(WorkstationManager, 'getInstance').mockReturnValue({ getSystem: async () => { throw new Error('storage failed'); } } as unknown as WorkstationManager);
    await home['loadProgress'](home['viewVersion']);
    expect(home['progressFailed']).toBe(true);
    home.scene = { start: vi.fn() } as unknown as Phaser.Scenes.ScenePlugin;
    home['startMode'](false, 2);
    home['startMode'](false, 2);
    expect(controller.getGameState().currentLevel).toBe(3);
    expect(home.scene.start).toHaveBeenCalledOnce();
  });

  it('continues at the first uncleared stage without skipping a gap in route progress', () => {
    home['records'] = {
      'classic:1': stored.journey.records['classic:1'],
      'classic:3': stored.journey.records['classic:1'],
      'afterimage:2': stored.journey.records['classic:1']
    };
    home.scene = { start: vi.fn() } as unknown as Phaser.Scenes.ScenePlugin;
    home['continueRoute']();
    home['continueRoute']();
    expect(controller.getGameState().currentLevel).toBe(2);
    expect(home.scene.start).toHaveBeenCalledOnce();
    expect(home.scene.start).toHaveBeenCalledWith('MainScene', { gameController: controller, gameConfig: config, afterimageMode: false });
  });

  it('offers a new run from the first stage after the whole classic route is cleared', async () => {
    const records: typeof home['records'] = {};
    for (let i = 0; i < levelConfigs.length; i++) records[`classic:${levelConfigs[i].level}`] = stored.journey.records['classic:1'];
    const completed = { getState: () => ({ coins: 130, journey: { records, pendingRewards: [] } }) } as unknown as WorkstationSystem;
    vi.spyOn(WorkstationManager, 'getInstance').mockReturnValue({ getSystem: async () => completed } as unknown as WorkstationManager);
    const action = { setText: vi.fn().mockReturnThis() };
    home['primaryActionText'] = action as unknown as Phaser.GameObjects.Text;
    home.scene = { start: vi.fn() } as unknown as Phaser.Scenes.ScenePlugin;
    controller.advanceLevel();
    await home['loadProgress'](home['viewVersion']);
    expect(action.setText).toHaveBeenLastCalledWith('再次挑战');
    home['continueRoute']();
    expect(controller.getGameState().currentLevel).toBe(1);
    expect(home.scene.start).toHaveBeenCalledOnce();
  });

  it('opens the workstation once without restarting or advancing the current run', () => {
    controller.advanceLevel();
    const before = { ...controller.getGameState() };
    home.scene = { start: vi.fn() } as unknown as Phaser.Scenes.ScenePlugin;
    home['goToWorkstation']();
    home['goToWorkstation']();
    expect(home.scene.start).toHaveBeenCalledOnce();
    expect(home.scene.start).toHaveBeenCalledWith('WorkstationScene', { gameController: controller, gameConfig: config });
    expect(controller.getGameState()).toEqual(before);
  });

  it('refreshes the open route after loading without writing to removed lobby objects', async () => {
    let resolve!: (value: WorkstationSystem) => void;
    const pending = new Promise<WorkstationSystem>(done => { resolve = done; });
    vi.spyOn(WorkstationManager, 'getInstance').mockReturnValue({ getSystem: () => pending } as unknown as WorkstationManager);
    const removedText = { setText: vi.fn(() => { throw new Error('destroyed text'); }) } as unknown as Phaser.GameObjects.Text;
    home['homeProgress'] = removedText;
    home['coinBalance'] = removedText;
    home['nextStageText'] = removedText;
    home['showRoute'] = vi.fn();
    home['showStageBrief'] = vi.fn();
    const task = home['loadProgress'](home['viewVersion']);
    home['view'] = 'classic';
    home['stageIndex'] = 2;
    resolve(system);
    await task;
    expect(home['progressLoaded']).toBe(true);
    expect(home['progressFailed']).toBe(false);
    expect(removedText.setText).not.toHaveBeenCalled();
    expect(home['showRoute']).toHaveBeenCalledWith(false);
    expect(home['showStageBrief']).toHaveBeenCalledWith(false, 2);
  });
});
