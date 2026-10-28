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

const stored = { journey: { records: { 'classic:1': { clears: 1, bestScore: 25, bestCombo: 1, fewestShots: 1 } }, pendingRewards: [{ items: [{ type: 'document', level: 3 }, { type: 'document', level: 3 }] }] } };
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
    const title = { setText: vi.fn() };
    const inbox = { setText: vi.fn() };
    home['homeProgress'] = title as unknown as Phaser.GameObjects.Text;
    home['workstationProgress'] = inbox as unknown as Phaser.GameObjects.Text;
    await home['loadProgress'](home['viewVersion']);
    expect(title.setText).toHaveBeenCalledWith('已通关 1 / 8 · 过关带物资，回工位养搭子');
    expect(inbox.setText).toHaveBeenCalledWith('2 件通关物资待领取');
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
});
