import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type Phaser from 'phaser';
import { MainScene } from '../MainScene';
import { UpgradeScene } from '../UpgradeScene';
import { ShotQueue } from '../../core/ShotQueue';
import { GameController } from '../../core/GameController';
import ballLevels from '../../config/ballLevels.json';
import levelConfigs from '../../config/levelConfig.json';
import config from '../../config/gameConfig.json';

vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }));

describe('scene turn lifecycle', () => {
  let scene: MainScene;
  let controller: GameController;

  beforeEach(() => {
    scene = new MainScene();
    controller = new GameController(ballLevels, levelConfigs, config);
    scene.init({ gameController: controller, gameConfig: config });
    scene['comboText'] = { visible: false } as Phaser.GameObjects.Text;
    scene.scene = { start: vi.fn() } as unknown as Phaser.Scenes.ScenePlugin;
    scene['canShoot'] = false;
    scene.time = { delayedCall: vi.fn((_delay: number, callback: () => void) => callback()) } as unknown as Phaser.Time.Clock;
  });

  it('unlocks after 450ms even while other fruit is moving', () => {
    scene['balls'] = [{ body: { velocity: { x: 4, y: 8 } } as MatterJS.BodyType, sprite: {} as Phaser.GameObjects.Arc, level: 1 }];
    scene.update(449);
    expect(scene['canShoot']).toBe(false);
    scene.update(450);
    expect(scene['canShoot']).toBe(true);
  });

  it('does not settle at a brief zero velocity point during a bounce', () => {
    while (controller.getGameState().shotsRemaining > 0) controller.useShot();
    const body = { velocity: { x: 0, y: 0 }, isSleeping: false } as MatterJS.BodyType;
    scene['balls'] = [{ body, sprite: {} as Phaser.GameObjects.Arc, level: 1 }];
    scene.update(600);
    body.velocity.y = 2;
    scene.update(700);
    body.velocity.y = 0;
    scene.update(1001);
    expect(scene['canShoot']).toBe(false);
  });

  it('waits for the final shot to settle and transitions only once', () => {
    while (controller.getGameState().shotsRemaining > 0) controller.useShot();
    scene.update(600);
    expect(scene.scene.start).not.toHaveBeenCalled();
    scene.update(1001);
    scene.update(3600);
    scene.update(4000);
    expect(scene.scene.start).toHaveBeenCalledTimes(1);
    expect(scene.scene.start).toHaveBeenCalledWith('GameOverScene', expect.any(Object));
    expect(scene['canShoot']).toBe(false);
  });

  it('allows the last shot to win before checking failure', () => {
    while (controller.getGameState().shotsRemaining > 0) controller.useShot();
    controller.processMerge(2, 1000);
    scene.update(1100);
    scene.update(1600);
    expect(scene.scene.start).toHaveBeenCalledWith('UpgradeScene', expect.any(Object));
  });

  it('merges a ball only once when multiple collision pairs share it', () => {
    const first = { body: {} as MatterJS.BodyType, sprite: {} as Phaser.GameObjects.Arc, level: 1 };
    const second = { ...first };
    const third = { ...first };
    scene['balls'] = [first, second, third];
    scene['pendingMerges'] = [[first, second], [first, third]];
    scene['canShoot'] = true;
    scene['mergeBalls'] = vi.fn((a, b) => {
      scene['balls'] = scene['balls'].filter(ball => ball !== a && ball !== b);
    });
    scene.update(600);
    expect(scene['mergeBalls']).toHaveBeenCalledTimes(1);
    expect(scene['balls']).toEqual([third]);
  });

  it('awards wall bonuses only for walls and removes listeners at shutdown', () => {
    const world = new EventEmitter();
    scene.matter = { world } as unknown as Phaser.Physics.Matter.MatterPhysics;
    scene.events = new EventEmitter() as unknown as Phaser.Events.EventEmitter;
    scene['updateUI'] = vi.fn();
    const body = { label: 'ball_1' } as MatterJS.BodyType;
    scene['balls'] = [{ body, sprite: {} as Phaser.GameObjects.Arc, level: 1 }];
    controller.applyUpgrade({ id: 'wall_bounce_score', name: '', description: '', type: 'passive', value: 10 });
    scene['setupCollisions']();
    world.emit('collisionstart', { pairs: [{ bodyA: body, bodyB: { label: 'peg', isStatic: true } }] });
    expect(controller.getGameState().score).toBe(0);
    world.emit('collisionstart', { pairs: [{ bodyA: body, bodyB: { label: 'wall', isStatic: true } }] });
    expect(controller.getGameState().score).toBe(10);
    scene.matter = { world: null } as unknown as Phaser.Physics.Matter.MatterPhysics;
    scene.events.emit('shutdown');
    expect(world.listenerCount('collisionstart')).toBe(0);
  });

  it('does not spend a swap on identical fruit and preserves shot count', () => {
    scene['canShoot'] = true;
    scene['uiTexts'].hint = { setText: vi.fn() } as unknown as Phaser.GameObjects.Text;
    scene['updateUI'] = vi.fn();
    const shots = controller.getGameState().shotsRemaining;
    scene['swapBall']();
    expect(scene['swapsRemaining']).toBe(2);
    scene['shotQueue'] = new ShotQueue(1, 2, () => 0);
    scene['shotQueue'].take();
    scene['shotQueue'].take();
    const before = scene['shotQueue'].peek();
    expect(before[0]).not.toBe(before[1]);
    scene['swapBall']();
    expect(scene['shotQueue'].peek()[0]).toBe(before[1]);
    expect(scene['swapsRemaining']).toBe(1);
    expect(controller.getGameState().shotsRemaining).toBe(shots);
  });

  it('allows one rescue shake after the last shot and wakes sleeping fruit', () => {
    while (controller.getGameState().shotsRemaining > 0) controller.useShot();
    const setAwake = vi.fn();
    const setVelocity = vi.fn();
    scene['balls'] = [{ body: { position: { x: 100, y: 1000 } } as MatterJS.BodyType, sprite: { setAwake } as unknown as Phaser.GameObjects.Image, level: 1 }];
    scene.matter = { body: { setVelocity } } as unknown as Phaser.Physics.Matter.MatterPhysics;
    scene.cameras = { main: { shake: vi.fn() } } as unknown as Phaser.Cameras.Scene2D.CameraManager;
    scene['updateUI'] = vi.fn();
    scene['settledSince'] = 1000;
    scene['shakeBoard']();
    scene['shakeBoard']();
    expect(setAwake).toHaveBeenCalledTimes(1);
    expect(setVelocity).toHaveBeenCalledTimes(1);
    expect(scene['shakesRemaining']).toBe(0);
    expect(scene['settledSince']).toBeNull();
  });

  it('ignores repeated upgrade clicks during a transition', () => {
    const upgradeScene = new UpgradeScene();
    upgradeScene.init({ gameController: controller, gameConfig: config });
    upgradeScene.input = { enabled: true } as Phaser.Input.InputPlugin;
    upgradeScene.cameras = { main: { fadeOut: vi.fn() } } as unknown as Phaser.Cameras.Scene2D.CameraManager;
    upgradeScene.time = { delayedCall: vi.fn() } as unknown as Phaser.Time.Clock;
    const upgrade = { id: 'extra_shot', name: '', description: '', type: 'stat' as const, value: 1 };
    upgradeScene['selectUpgrade'](upgrade);
    upgradeScene['selectUpgrade'](upgrade);
    expect(controller.getGameState().currentLevel).toBe(2);
    expect(controller.getGameState().shotsRemaining).toBe(levelConfigs[1].shots + 1);
    expect(controller.getGameState().upgrades).toHaveLength(1);
  });
});
