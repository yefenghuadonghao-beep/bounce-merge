import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type Phaser from 'phaser';
import { setPlatform } from '../../platform';
import { WebPlatform } from '../../platform/WebPlatform';
import { MainScene } from '../MainScene';
import { UpgradeScene } from '../UpgradeScene';
import { battlePlanEffects, battlePlans } from '../../core/BattlePlan';
import { ShotQueue } from '../../core/ShotQueue';
import { GameController } from '../../core/GameController';
import ballLevels from '../../config/ballLevels.json';
import levelConfigs from '../../config/levelConfig.json';
import shadowLevels from '../../config/afterimageLevels.json';
import config from '../../config/gameConfig.json';

vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: { SHUTDOWN: 'shutdown' } } } }));

// 场景通过 getPlatform() 取存档/音效，入口外需显式注册。
beforeEach(() => setPlatform(new WebPlatform()));

// 胜利后等待玩家看完已保存的回执，再由按钮进入下一场景。
function continueAfterReward(scene: MainScene, controller: GameController) {
  scene['rewardReceipt'] = {
    id: controller.getCompletionId(),
    mode: scene['afterimageMode'] ? 'afterimage' : 'classic',
    level: controller.getGameState().currentLevel,
    firstClear: true,
    coins: 35,
    items: [{ type: 'document', level: 3 }],
    newBest: true
  };
  scene['continueVictory']();
}

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
    scene['showVictory'] = vi.fn();
    scene.time = { delayedCall: vi.fn((_delay: number, callback: () => void) => callback()) } as unknown as Phaser.Time.Clock;
  });

  it('previewing and cancelling gather never spends a tool or fires a ball', () => {
    scene['shakesRemaining'] = 2;
    scene['balls'] = [{ body: { position: { x: 100 } } as MatterJS.BodyType, sprite: {} as Phaser.GameObjects.Image, level: 1 }];
    const shots = controller.getGameState().shotsRemaining;
    scene['beginTool']('gather');
    expect(scene['toolMode']).toBe('gather');
    expect(scene['shakesRemaining']).toBe(2);
    scene['beginTool']('gather');
    expect(scene['toolMode']).toBeUndefined();
    expect(scene['shakesRemaining']).toBe(2);
    expect(controller.getGameState().shotsRemaining).toBe(shots);
  });

  it('gathers toward the selected side and spends exactly one use', () => {
    scene['shakesRemaining'] = 2;
    const setVelocity = vi.fn();
    scene.matter = { body: { setVelocity } } as unknown as Phaser.Physics.Matter.MatterPhysics;
    scene.cameras = { main: { shake: vi.fn() } } as unknown as Phaser.Cameras.Scene2D.CameraManager;
    scene['updateUI'] = vi.fn();
    scene['balls'] = [{ body: { position: { x: 100 } } as MatterJS.BodyType, sprite: { setAwake: vi.fn() } as unknown as Phaser.GameObjects.Image, level: 1 }];
    scene['shakeBoard'](600);
    expect(setVelocity).toHaveBeenCalledWith(scene['balls'][0].body, { x: 12.5, y: -7 });
    expect(scene['shakesRemaining']).toBe(1);
    expect(controller.getLevelShotsUsed()).toBe(0);
  });

  it('dismisses an open tool picker before presenting a completed level', () => {
    scene['toolMode'] = 'swap';
    const destroy = vi.fn();
    scene['toolOverlay'] = { destroy } as unknown as Phaser.GameObjects.Container;
    controller.processMerge(1, 1000);
    scene.update(1500);
    expect(scene['showVictory']).toHaveBeenCalledOnce();
    expect(scene['toolMode']).toBeUndefined();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('requires a shadow merge before completing the afterimage goal', () => {
    scene.init({ gameController: controller, gameConfig: config, afterimageMode: true });
    controller.processMerge(2, 1000);
    scene.update(1100);
    expect(scene.scene.start).not.toHaveBeenCalled();
    scene['afterimageMergeCount'] = 1;
    scene.update(1400);
    expect(scene['showVictory']).toHaveBeenCalledOnce();
    expect(scene.scene.start).not.toHaveBeenCalled();
    continueAfterReward(scene, controller);
    expect(scene.scene.start).toHaveBeenCalledWith('UpgradeScene', expect.objectContaining({ afterimageMode: true }));
  });

  it('does not finish the final shadow round after only one resonance', () => {
    controller.startRun(shadowLevels);
    for (let i = 0; i < 3; i++) controller.advanceLevel();
    scene.init({ gameController: controller, gameConfig: config, afterimageMode: true });
    controller.processMerge(5, 1000);
    scene['afterimageMergeCount'] = 3;
    scene.update(1100);
    expect(scene.scene.start).not.toHaveBeenCalled();
    scene['afterimageMergeCount'] = 4;
    scene.update(1400);
    expect(scene['showVictory']).toHaveBeenCalledOnce();
    expect(scene.scene.start).not.toHaveBeenCalled();
    continueAfterReward(scene, controller);
    expect(scene.scene.start).toHaveBeenCalledWith('GameOverScene', expect.objectContaining({ won: true }));
  });

  it('does not create shadows for preset or merged balls', () => {
    scene.init({ gameController: controller, gameConfig: config, afterimageMode: true });
    scene['balls'] = [{ body: { velocity: { x: 4, y: 8 } } as MatterJS.BodyType, sprite: { x: 360, y: 700 } as Phaser.GameObjects.Image, level: 1 }];
    scene['updateAfterimages']();
    expect(scene['afterimageSystem']?.getTracks().size).toBe(0);
  });

  it('freezes pending merges after the result has been decided', () => {
    scene['resolving'] = true;
    scene['mergeBalls'] = vi.fn();
    const first = { body: {} as MatterJS.BodyType, sprite: {} as Phaser.GameObjects.Arc, level: 1 };
    const second = { ...first };
    scene['balls'] = [first, second];
    scene['pendingMerges'] = [[first, second]];
    scene.update(2000);
    expect(scene['mergeBalls']).not.toHaveBeenCalled();
  });

  it('applies the selected plan to tools and rotates three balls without spending a shot', () => {
    controller.applyUpgrade(battlePlans()[1]);
    controller.advanceLevel();
    scene.init({ gameController: controller, gameConfig: config });
    scene['shotQueue'] = new ShotQueue(1, 9, Math.random, [1, 2, 3, 1]);
    scene['canShoot'] = true;
    scene['updateUI'] = vi.fn();
    const shots = controller.getGameState().shotsRemaining;
    expect(scene['swapsRemaining']).toBe(levelConfigs[1].swaps + 2);
    scene['swapBall']();
    expect(scene['shotQueue'].peek()).toEqual([2, 3, 1]);
    expect(scene['swapsRemaining']).toBe(levelConfigs[1].swaps + 1);
    expect(controller.getGameState().shotsRemaining).toBe(shots);
  });

  it('applies late plan costs and restores the chosen plan on retry', () => {
    for (let i = 0; i < 3; i++) controller.advanceLevel();
    controller.applyUpgrade(battlePlans()[2]);
    controller.advanceLevel();
    scene.init({ gameController: controller, gameConfig: config });
    expect(scene['shakesRemaining']).toBe(levelConfigs[4].shakes + 1);
    expect(scene['swapsRemaining']).toBe(0);
    expect(scene['charge'].threshold).toBe(3);
    scene['shakesRemaining'] = 0;
    controller.retryLevel();
    scene.init({ gameController: controller, gameConfig: config });
    expect(scene['shakesRemaining']).toBe(levelConfigs[4].shakes + 1);
    expect(scene['charge'].threshold).toBe(3);
  });

  it('direct preview selection spends one swap and leaves shot count unchanged', () => {
    controller.applyUpgrade(battlePlans()[1]);
    controller.advanceLevel();
    scene.init({ gameController: controller, gameConfig: config });
    scene['shotQueue'] = new ShotQueue(1, 9, Math.random, [1, 2, 3, 4]);
    scene['updateUI'] = vi.fn();
    const shots = controller.getGameState().shotsRemaining;
    scene['swapBall'](2);
    expect(scene['shotQueue'].peek()).toEqual([3, 2, 1]);
    expect(scene['swapsRemaining']).toBe(2);
    expect(controller.getGameState().shotsRemaining).toBe(shots);
  });

  it('refunds the chain plan swap on its first charge reward only', () => {
    for (let i = 0; i < 3; i++) controller.advanceLevel();
    controller.applyUpgrade(battlePlans()[2]);
    controller.advanceLevel();
    scene.init({ gameController: controller, gameConfig: config });
    for (let i = 0; i < 3; i++) scene['charge'].add(1);
    expect(scene['refundPlanSwap']()).toBe(true);
    expect(scene['swapsRemaining']).toBe(1);
    for (let i = 0; i < 3; i++) scene['charge'].add(1);
    expect(scene['refundPlanSwap']()).toBe(false);
    expect(scene['swapsRemaining']).toBe(1);
    controller.retryLevel();
    scene.init({ gameController: controller, gameConfig: config });
    expect(scene['swapsRemaining']).toBe(0);
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
    expect(scene['showVictory']).toHaveBeenCalledOnce();
    expect(scene.scene.start).not.toHaveBeenCalled();
    continueAfterReward(scene, controller);
    expect(scene.scene.start).toHaveBeenCalledWith('UpgradeScene', expect.any(Object));
  });

  it('keeps a settled rescue available without an invisible timeout', () => {
    while (controller.getGameState().shotsRemaining > 0) controller.useShot();
    scene['shakesRemaining'] = 2;
    scene['balls'] = [{ body: { velocity: { x: 0, y: 0 }, isSleeping: true } as MatterJS.BodyType, sprite: {} as Phaser.GameObjects.Image, level: 1 }];
    scene['updateUI'] = vi.fn();
    scene['uiTexts'].hint = { setText: vi.fn() } as unknown as Phaser.GameObjects.Text;
    scene['finishRescue']();
    expect(scene.scene.start).not.toHaveBeenCalled();
    scene.update(1100);
    scene.update(1900);
    scene.update(60000);
    expect(scene['awaitingRescue']).toBe(true);
    expect(scene['uiTexts'].hint.setText).toHaveBeenLastCalledWith('还剩 2 次抱团 · 想好再用，或结束本关');
    expect(scene.scene.start).not.toHaveBeenCalled();
    scene['finishRescue']();
    scene['finishRescue']();
    expect(scene.scene.start).toHaveBeenCalledOnce();
    expect(scene.scene.start).toHaveBeenCalledWith('GameOverScene', expect.objectContaining({ won: false, afterimageMerges: 0 }));
  });

  it('withdraws the finish action if the board moves again', () => {
    while (controller.getGameState().shotsRemaining > 0) controller.useShot();
    const body = { velocity: { x: 0, y: 0 }, isSleeping: false } as MatterJS.BodyType;
    scene['balls'] = [{ body, sprite: {} as Phaser.GameObjects.Image, level: 1 }];
    scene['shakesRemaining'] = 1;
    scene['updateUI'] = vi.fn();
    scene.update(1100);
    scene.update(1900);
    expect(scene['awaitingRescue']).toBe(true);
    body.velocity.y = 2;
    scene['finishRescue']();
    expect(scene.scene.start).not.toHaveBeenCalled();
    scene.update(2000);
    expect(scene['awaitingRescue']).toBe(false);
    expect(scene['settledSince']).toBeNull();
  });

  it('does not wait forever when a remaining shake has no balls to affect', () => {
    while (controller.getGameState().shotsRemaining > 0) controller.useShot();
    scene['shakesRemaining'] = 1;
    scene.update(1100);
    scene.update(1900);
    expect(scene['awaitingRescue']).toBe(false);
    expect(scene.scene.start).toHaveBeenCalledOnce();
  });

  it('sends actual shadow progress to the failed report', () => {
    controller.startRun(shadowLevels);
    scene.init({ gameController: controller, gameConfig: config, afterimageMode: true });
    while (controller.getGameState().shotsRemaining > 0) controller.useShot();
    scene['afterimageMergeCount'] = 2;
    scene.update(2000);
    scene.update(2800);
    expect(scene.scene.start).toHaveBeenCalledWith('GameOverScene', expect.objectContaining({ won: false, afterimageMode: true, afterimageMerges: 2 }));
  });

  it('clears a pending rescue when the scene is reinitialized', () => {
    scene['awaitingRescue'] = true;
    scene.init({ gameController: controller, gameConfig: config });
    expect(scene['awaitingRescue']).toBe(false);
    scene['finishRescue']();
    expect(scene.scene.start).not.toHaveBeenCalled();
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
    scene['swapsRemaining'] = 2;
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
    scene['shakesRemaining'] = 1;
    while (controller.getGameState().shotsRemaining > 0) controller.useShot();
    const setAwake = vi.fn();
    const setVelocity = vi.fn();
    scene['balls'] = [{ body: { position: { x: 100, y: 1000 } } as MatterJS.BodyType, sprite: { setAwake } as unknown as Phaser.GameObjects.Image, level: 1 }];
    scene.matter = { body: { setVelocity } } as unknown as Phaser.Physics.Matter.MatterPhysics;
    scene.cameras = { main: { shake: vi.fn() } } as unknown as Phaser.Cameras.Scene2D.CameraManager;
    scene['updateUI'] = vi.fn();
    scene['settledSince'] = 1000;
    scene['awaitingRescue'] = true;
    scene['shakeBoard']();
    scene['shakeBoard']();
    expect(setAwake).toHaveBeenCalledTimes(1);
    expect(setVelocity).toHaveBeenCalledTimes(1);
    expect(scene['shakesRemaining']).toBe(0);
    expect(scene['settledSince']).toBeNull();
    expect(scene['awaitingRescue']).toBe(false);
  });

  it('converts a three-merge chain into a rescue without spending shots, resetting next stage', () => {
    const label = { setOrigin: vi.fn(), setDepth: vi.fn(), destroy: vi.fn() };
    label.setOrigin.mockReturnValue(label);
    label.setDepth.mockReturnValue(label);
    scene.add = { text: vi.fn(() => label) } as unknown as Phaser.GameObjects.GameObjectFactory;
    scene.tweens = { add: vi.fn() } as unknown as Phaser.Tweens.TweenManager;
    scene.cameras = { main: { shake: vi.fn() } } as unknown as Phaser.Cameras.Scene2D.CameraManager;
    scene['createMergeEffect'] = vi.fn();
    scene['showScorePopup'] = vi.fn();
    scene['removeBall'] = vi.fn();
    scene['spawnBall'] = vi.fn();
    scene['updateUI'] = vi.fn();
    const shots = controller.getGameState().shotsRemaining;
    const ball = { body: {} as MatterJS.BodyType, sprite: { x: 360, y: 900 } as Phaser.GameObjects.Image, level: 1 };
    for (let i = 0; i < 3; i++) {
      Object.assign(scene.time, { now: 100 + i * 100 });
      scene['mergeBalls'](ball, { ...ball });
    }
    expect(scene['shakesRemaining']).toBe(levelConfigs[0].shakes + 1);
    expect(scene['charge'].rewards).toBe(1);
    expect(controller.getGameState().shotsRemaining).toBe(shots);
    controller.advanceLevel();
    scene.init({ gameController: controller, gameConfig: config });
    expect(scene['shakesRemaining']).toBe(1);
    expect(scene['charge'].charge).toBe(0);
  });

  it('ignores repeated upgrade clicks during a transition', () => {
    const upgradeScene = new UpgradeScene();
    upgradeScene.init({ gameController: controller, gameConfig: config });
    upgradeScene.input = { enabled: true } as Phaser.Input.InputPlugin;
    upgradeScene.cameras = { main: { fadeOut: vi.fn() } } as unknown as Phaser.Cameras.Scene2D.CameraManager;
    upgradeScene.time = { delayedCall: vi.fn() } as unknown as Phaser.Time.Clock;
    const upgrade = battlePlans()[0];
    upgradeScene['selectUpgrade'](upgrade);
    upgradeScene['selectUpgrade'](upgrade);
    expect(controller.getGameState().currentLevel).toBe(2);
    expect(controller.getGameState().shotsRemaining).toBe(levelConfigs[1].shots + 2);
    expect(controller.getGameState().upgrades).toHaveLength(0);
    expect(controller.getGameState().activePlan?.id).toBe('plan_supply');
  });
});


describe('chapter completion and safe upgrades', () => {
  it('ends chapter eight instead of advancing to a repeated ninth board', () => {
    const controller = new GameController(ballLevels, levelConfigs, config);
    for (let i = 1; i < 8; i++) controller.advanceLevel();
    controller.processMerge(5, 1000);
    const scene = new MainScene();
    scene.init({ gameController: controller, gameConfig: config });
    scene['comboText'] = { visible: false } as Phaser.GameObjects.Text;
    scene['showVictory'] = vi.fn();
    scene.scene = { start: vi.fn() } as unknown as Phaser.Scenes.ScenePlugin;
    scene.time = { delayedCall: vi.fn((_delay: number, callback: () => void) => callback()) } as unknown as Phaser.Time.Clock;
    scene.update(1200);
    expect(scene['showVictory']).toHaveBeenCalledOnce();
    expect(scene.scene.start).not.toHaveBeenCalled();
    continueAfterReward(scene, controller);
    expect(scene.scene.start).toHaveBeenCalledWith('GameOverScene', expect.objectContaining({ won: true }));
  });
  it('always offers three different next-level tactics, including late in the run', () => {
    const controller = new GameController(ballLevels, levelConfigs, config);
    for (let stage = 1; stage < 8; stage++) {
      const offered = battlePlans();
      expect(new Set(offered.map(card => card.id)).size).toBe(3);
      expect(offered.every(card => card.scope === 'next_level')).toBe(true);
      controller.applyUpgrade(offered[0]);
      controller.advanceLevel();
      expect(controller.getGameState().shotsRemaining).toBe(levelConfigs[stage].shots + battlePlanEffects(offered[0], levelConfigs[stage]).shots);
      expect(controller.getGameState().upgrades).toHaveLength(0);
    }
  });
});
