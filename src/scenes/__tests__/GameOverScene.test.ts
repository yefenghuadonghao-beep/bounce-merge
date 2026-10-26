import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { setPlatform } from '../../platform';
import { WebPlatform } from '../../platform/WebPlatform';
import { GameOverScene } from '../GameOverScene';
import { GameController } from '../../core/GameController';
import balls from '../../config/ballLevels.json';
import levels from '../../config/levelConfig.json';
import config from '../../config/gameConfig.json';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));

// 场景通过 getPlatform() 取存档/音效，入口外需显式注册。
beforeEach(() => setPlatform(new WebPlatform()));

describe('retry and personal record', () => {
  let scene: GameOverScene;
  let controller: GameController;

  beforeEach(() => {
    localStorage.clear();
    scene = new GameOverScene();
    controller = new GameController(balls, levels, config);
    scene.init({ gameController: controller, gameConfig: config });
    scene.scene = { start: vi.fn() } as unknown as Phaser.Scenes.ScenePlugin;
  });

  it('keeps a previous best when the current run scores less', async () => {
    localStorage.setItem('bouncemergegame_best_score', '100');
    const label = { active: true, setText: vi.fn() };
    await scene['saveRecord'](label as unknown as Phaser.GameObjects.Text);
    expect(localStorage.getItem('bouncemergegame_best_score')).toBe('100');
    expect(label.setText).toHaveBeenCalledWith('个人最佳 100');
  });

  it('stores a new best and does not write to a destroyed scene label', async () => {
    controller.processMerge(2, 1000);
    const label = { active: false, setText: vi.fn() };
    await scene['saveRecord'](label as unknown as Phaser.GameObjects.Text);
    expect(localStorage.getItem('bouncemergegame_best_score')).toBe('50');
    expect(label.setText).not.toHaveBeenCalled();
  });

  it('restarts only once and resets score, level and shots', () => {
    controller.processMerge(2, 1000);
    controller.advanceLevel();
    controller.useShot();
    scene['restart']();
    scene['restart']();
    expect(scene.scene.start).toHaveBeenCalledTimes(1);
    expect(controller.getGameState()).toMatchObject({ score: 0, currentLevel: 1, shotsRemaining: levels[0].shots });
  });
});
