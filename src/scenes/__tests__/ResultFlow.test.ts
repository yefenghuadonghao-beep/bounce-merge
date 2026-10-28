import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { GameOverScene } from '../GameOverScene';
import { GameController } from '../../core/GameController';
import { setPlatform } from '../../platform';
import { WebPlatform } from '../../platform/WebPlatform';
import balls from '../../config/ballLevels.json';
import levels from '../../config/levelConfig.json';
import config from '../../config/gameConfig.json';

const actions = vi.hoisted(() => new Map<string, () => void>());
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../../ui/hidpi', () => ({ setupHiDpi: vi.fn() }));
vi.mock('../../ui/officeEffects', () => ({ paperConfetti: vi.fn() }));
vi.mock('../../ui/theme', async original => ({
  ...await original<typeof import('../../ui/theme')>(),
  paper: vi.fn(),
  panel: vi.fn(),
  button: (_scene: unknown, _x: number, _y: number, _width: number, text: string, action: () => void) => actions.set(text, action)
}));

function node() {
  return { active: true, y: 350, setDisplaySize: vi.fn().mockReturnThis(), setOrigin: vi.fn().mockReturnThis(), setAngle: vi.fn().mockReturnThis(), setAlpha: vi.fn().mockReturnThis(), setScale: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setText: vi.fn().mockReturnThis(), lineStyle: vi.fn().mockReturnThis(), lineBetween: vi.fn().mockReturnThis() };
}

describe('result report actions', () => {
  let scene: GameOverScene;
  let controller: GameController;
  beforeEach(() => {
    localStorage.clear();
    actions.clear();
    setPlatform(new WebPlatform());
    controller = new GameController(balls, levels, config);
    controller.advanceLevel();
    controller.useShot();
    scene = new GameOverScene();
    scene.scene = { start: vi.fn() } as unknown as Phaser.Scenes.ScenePlugin;
    scene.add = { text: vi.fn(node), image: node, circle: node, graphics: node, container: node } as unknown as Phaser.GameObjects.GameObjectFactory;
    scene.children = { length: 0, list: [] } as unknown as Phaser.GameObjects.DisplayList;
    scene.tweens = { add: vi.fn() } as unknown as Phaser.Tweens.TweenManager;
  });
  it('retries the same failed stage once and restores its shots', () => {
    scene.init({ gameController: controller, gameConfig: config, won: false });
    scene.create();
    actions.get('再试第 2 关')!();
    actions.get('再试第 2 关')!();
    expect(controller.getGameState()).toMatchObject({ currentLevel: 2, shotsRemaining: levels[1].shots });
    expect(scene.scene.start).toHaveBeenCalledOnce();
    expect(scene.scene.start).toHaveBeenCalledWith('MainScene', expect.objectContaining({ afterimageMode: false }));
  });
  it('opens the workstation after a win without resetting the completed run', () => {
    scene.init({ gameController: controller, gameConfig: config, won: true });
    scene.create();
    actions.get('去工位，看看搭子')!();
    expect(scene.scene.start).toHaveBeenCalledWith('WorkstationScene', expect.objectContaining({ gameController: controller }));
    expect(controller.getGameState().currentLevel).toBe(2);
  });
  it('offers a separate full-run restart after winning', () => {
    scene.init({ gameController: controller, gameConfig: config, won: true });
    scene.create();
    actions.get('再挑战一次')!();
    expect(controller.getGameState()).toMatchObject({ currentLevel: 1, shotsRemaining: levels[0].shots });
    expect(scene.scene.start).toHaveBeenCalledWith('MainScene', expect.any(Object));
  });
  it('shows the failed stage progress and labels stage versus cumulative statistics', () => {
    controller.processMerge(1, 1000);
    scene.init({ gameController: controller, gameConfig: config, won: false });
    scene.create();
    const text = vi.mocked(scene.add.text).mock.calls.map(call => call[2]);
    expect(text).toContain('放空豚');
    expect(text).toContain('暴躁鼠');
    expect(text).toContain('合成目标还差 1 级');
    expect(text).toContain('本关快乐值');
    expect(text).toContain('本关最高连合');
    expect(text).toContain('本轮累计 25 快乐值 · 1 次合成');
  });
  it('uses the resonance snapshot passed by the board and clears it on the next init', () => {
    const shadow = new GameController(balls, [{ ...levels[1], level: 1, requiredAfterimageMerges: 4 }], config);
    shadow.processMerge(2, 1000);
    scene.init({ gameController: shadow, gameConfig: config, won: false, afterimageMode: true, afterimageMerges: 2 });
    scene.create();
    let text = vi.mocked(scene.add.text).mock.calls.map(call => call[2]);
    expect(text).toContain('目标搭子已合出');
    expect(text).toContain('残影共鸣 2 / 4 · 还差 2 次');
    vi.mocked(scene.add.text).mockClear();
    scene.init({ gameController: shadow, gameConfig: config, won: false, afterimageMode: true });
    scene.create();
    text = vi.mocked(scene.add.text).mock.calls.map(call => call[2]);
    expect(text).toContain('共鸣目标 4 次');
    expect(text).not.toContain('残影共鸣 2 / 4 · 还差 2 次');
  });
});
