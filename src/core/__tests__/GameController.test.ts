import { describe, it, expect, beforeEach } from 'vitest';
import { GameController } from '../GameController';
import { BallLevel, LevelConfig, GameConfig, Upgrade } from '../../types';

const mockBallLevels: BallLevel[] = [
  { level: 1, radius: 12, color: 0xff6b6b, score: 10 },
  { level: 2, radius: 14, color: 0xfeca57, score: 25 },
  { level: 3, radius: 16, color: 0x48dbfb, score: 50 }
];

const mockLevelConfigs: LevelConfig[] = [
  { level: 1, targetScore: 500, shots: 15 },
  { level: 2, targetScore: 1000, shots: 15 }
];

const mockGameConfig: GameConfig = {
  width: 720,
  height: 1280,
  physics: {
    gravity: 1.5,
    restitution: 0.6,
    friction: 0.01,
    frictionAir: 0.001,
    density: 0.001
  },
  board: {
    pegRows: 10,
    pegColumns: 8,
    pegRadius: 5,
    pegColor: 0xdfe6e9,
    startY: 200,
    endY: 900,
    spacing: 70
  },
  launcher: {
    startX: 360,
    startY: 100,
    aimLineLength: 150,
    launchForce: 0.015
  },
  scoring: {
    comboDecayTime: 2000,
    comboMultiplier: 1.5
  }
};

describe('GameController', () => {
  let controller: GameController;

  beforeEach(() => {
    controller = new GameController(mockBallLevels, mockLevelConfigs, mockGameConfig);
  });

  it('should initialize with correct state', () => {
    const state = controller.getGameState();
    expect(state.currentLevel).toBe(1);
    expect(state.score).toBe(0);
    expect(state.shotsRemaining).toBe(15);
  });

  it('should get ball config', () => {
    const config = controller.getBallConfig(1);
    expect(config).toBeDefined();
    expect(config?.level).toBe(1);
  });

  it('should use shot', () => {
    controller.useShot();
    expect(controller.getGameState().shotsRemaining).toBe(14);
  });

  it('should check if balls can merge', () => {
    expect(controller.canMerge(1, 1)).toBe(true);
    expect(controller.canMerge(1, 2)).toBe(false);
  });

  it('should process merge and return score', () => {
    const result = controller.processMerge(1, 1000);
    expect(result.newLevel).toBe(2);
    expect(result.score).toBeGreaterThan(0);
    expect(controller.getGameState().combo).toBe(1);
  });

  it('should process wall bounce with upgrade', () => {
    const upgrade: Upgrade = {
      id: 'wall_bounce_score',
      name: 'Wall Bounce',
      description: 'Score on wall bounce',
      type: 'passive',
      value: 10
    };
    
    controller.applyUpgrade(upgrade);
    const score = controller.processWallBounce();
    expect(score).toBe(10);
  });

  it('should not score wall bounce without upgrade', () => {
    const score = controller.processWallBounce();
    expect(score).toBe(0);
  });

  it('should update combo expiration', () => {
    controller.processMerge(1, 1000);
    expect(controller.getGameState().combo).toBe(1);
    
    controller.updateCombo(1000 + 2500);
    expect(controller.getGameState().combo).toBe(0);
  });

  it('should check level completion states', () => {
    expect(controller.checkLevelComplete()).toBe('continue');
    
    for (let i = 0; i < 50; i++) {
      controller.processMerge(1, 1000 + i * 100);
    }
    
    expect(controller.checkLevelComplete()).toBe('win');
  });

  it('should detect level failure', () => {
    for (let i = 0; i < 15; i++) {
      controller.useShot();
    }
    
    expect(controller.checkLevelComplete()).toBe('lose');
  });

  it('should advance level', () => {
    controller.advanceLevel();
    const state = controller.getGameState();
    expect(state.currentLevel).toBe(2);
  });

  it('should apply upgrades', () => {
    const upgrade: Upgrade = {
      id: 'score_boost',
      name: 'Score Boost',
      description: 'Score +20%',
      type: 'multiplier',
      value: 1.2
    };
    
    controller.applyUpgrade(upgrade);
    expect(controller.getGameState().scoreMultiplier).toBe(1.2);
  });

  it('should get max ball level', () => {
    expect(controller.getMaxBallLevel()).toBe(3);
  });

  it('should reset game', () => {
    controller.useShot();
    controller.processMerge(1, 1000);
    controller.reset();
    
    const state = controller.getGameState();
    expect(state.score).toBe(0);
    expect(state.shotsRemaining).toBe(15);
    expect(state.combo).toBe(0);
  });

  it('should save and load game state', () => {
    controller.useShot();
    controller.processMerge(1, 1000);
    
    const saved = controller.save();
    const newController = new GameController(mockBallLevels, mockLevelConfigs, mockGameConfig);
    newController.load(saved);
    
    const state = newController.getGameState();
    expect(state.shotsRemaining).toBe(14);
    expect(state.combo).toBe(1);
  });
  it('returns the actual awarded score after upgrades', () => {
    controller.applyUpgrade({ id: 'score_boost', name: '', description: '', type: 'multiplier', value: 1.2 });
    const result = controller.processMerge(1, 1000);
    expect(result.score).toBe(30);
    expect(controller.getGameState().score).toBe(result.score);
  });

  it('expires combos before a new merge even without an update tick', () => {
    controller.processMerge(1, 1000);
    const result = controller.processMerge(1, 4000);
    expect(result.score).toBe(25);
    expect(controller.getGameState().combo).toBe(1);
  });

});


describe('run highlights', () => {
  it('preserves highlights across stages, ignores expired combos, and resets for a new run', () => {
    const controller = new GameController(mockBallLevels, mockLevelConfigs, mockGameConfig);
    controller.processMerge(1, 100);
    controller.processMerge(2, 200);
    controller.processMerge(1, 10000);
    expect(controller.getRunSummary()).toEqual({ merges: 3, bestCombo: 2, highest: 3 });
    controller.advanceLevel();
    expect(controller.getRunSummary().highest).toBe(3);
    const summary = controller.getRunSummary();
    summary.bestCombo = 999;
    expect(controller.getRunSummary().bestCombo).toBe(2);
    controller.reset();
    expect(controller.getRunSummary()).toEqual({ merges: 0, bestCombo: 0, highest: 1 });
  });
});


describe('level retry checkpoint', () => {
  it('restores entry score, upgrades and shots without farming merge highlights', () => {
    const controller = new GameController(mockBallLevels, mockLevelConfigs, mockGameConfig);
    controller.processMerge(1, 100);
    controller.applyUpgrade({ id: 'extra_shot', name: '', description: '', type: 'stat', value: 3 });
    controller.advanceLevel();
    const before = controller.getGameState();
    const summary = controller.getRunSummary();
    controller.processMerge(2, 200);
    controller.useShot();
    controller.retryLevel();
    expect(controller.getGameState()).toEqual(before);
    expect(controller.getRunSummary()).toEqual(summary);
    controller.reset();
    controller.retryLevel();
    expect(controller.getGameState().currentLevel).toBe(1);
    expect(controller.getGameState().upgrades).toHaveLength(0);
  });

  it('keeps current-stage highlights separate from earlier stages and failed attempts', () => {
    const controller = new GameController(mockBallLevels, mockLevelConfigs, mockGameConfig);
    controller.processMerge(2, 100);
    controller.processMerge(1, 200);
    controller.advanceLevel();
    expect(controller.getLevelSummary()).toEqual({ score: 0, merges: 0, bestCombo: 0, highest: 1 });
    const merged = controller.processMerge(1, 300);
    expect(controller.getLevelSummary()).toEqual({ score: merged.score, merges: 1, bestCombo: 1, highest: 2 });
    expect(controller.getRunSummary()).toEqual({ merges: 3, bestCombo: 2, highest: 3 });
    const copied = controller.getLevelSummary();
    copied.merges = 99;
    expect(controller.getLevelSummary().merges).toBe(1);
    controller.retryLevel();
    expect(controller.getLevelSummary()).toEqual({ score: 0, merges: 0, bestCombo: 0, highest: 1 });
    expect(controller.getRunSummary().merges).toBe(2);
  });

  it('counts awarded wall-bounce points in the stage score and clears them for a new run', () => {
    const controller = new GameController(mockBallLevels, mockLevelConfigs, mockGameConfig);
    controller.applyUpgrade({ id: 'wall_bounce_score', name: '', description: '', type: 'passive', value: 10 });
    controller.applyUpgrade({ id: 'score_boost', name: '', description: '', type: 'multiplier', value: 1.2 });
    controller.processWallBounce();
    expect(controller.getLevelSummary()).toEqual({ score: 12, merges: 0, bestCombo: 0, highest: 1 });
    controller.reset();
    expect(controller.getLevelSummary().score).toBe(0);
  });
});
