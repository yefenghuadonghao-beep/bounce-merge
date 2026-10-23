import { describe, it, expect, beforeEach } from 'vitest';
import { GameStateManager } from '../GameStateManager';
import { LevelConfig, Upgrade } from '../../types';

const mockLevelConfigs: LevelConfig[] = [
  { level: 1, targetScore: 500, shots: 15 },
  { level: 2, targetScore: 1000, shots: 15 },
  { level: 3, targetScore: 2000, shots: 15 }
];

describe('GameStateManager', () => {
  let manager: GameStateManager;

  beforeEach(() => {
    manager = new GameStateManager(mockLevelConfigs);
  });

  it('should initialize with default state', () => {
    const state = manager.getState();
    expect(state.currentLevel).toBe(1);
    expect(state.score).toBe(0);
    expect(state.shotsRemaining).toBe(15);
    expect(state.combo).toBe(0);
    expect(state.scoreMultiplier).toBe(1);
  });

  it('should add score correctly', () => {
    manager.addScore(100);
    expect(manager.getState().score).toBe(100);
  });

  it('should apply score multiplier', () => {
    const state = manager.getState();
    state.scoreMultiplier = 1.5;
    manager.setState(state);
    
    manager.addScore(100);
    expect(manager.getState().score).toBe(150);
  });

  it('should increment combo', () => {
    const currentTime = 1000;
    manager.incrementCombo(currentTime);
    
    const state = manager.getState();
    expect(state.combo).toBe(1);
    expect(state.comboTimer).toBe(currentTime);
  });

  it('should reset combo', () => {
    manager.incrementCombo(1000);
    manager.resetCombo();
    
    expect(manager.getState().combo).toBe(0);
  });

  it('should detect combo expiration', () => {
    manager.incrementCombo(1000);
    
    const expired = manager.checkComboExpired(1000 + 2500, 2000);
    expect(expired).toBe(true);
    expect(manager.getState().combo).toBe(0);
  });

  it('should not expire combo if within time limit', () => {
    manager.incrementCombo(1000);
    
    const expired = manager.checkComboExpired(1000 + 1500, 2000);
    expect(expired).toBe(false);
    expect(manager.getState().combo).toBe(1);
  });

  it('should use shot', () => {
    manager.useShot();
    expect(manager.getState().shotsRemaining).toBe(14);
  });

  it('should get correct level config', () => {
    const config = manager.getLevelConfig();
    expect(config.level).toBe(1);
    expect(config.targetScore).toBe(500);
  });

  it('should detect level completion', () => {
    manager.addScore(500);
    expect(manager.hasReachedTarget()).toBe(true);
  });

  it('should detect level failure', () => {
    for (let i = 0; i < 15; i++) {
      manager.useShot();
    }
    expect(manager.hasFailedLevel()).toBe(true);
  });

  it('should advance level', () => {
    manager.advanceLevel();
    
    const state = manager.getState();
    expect(state.currentLevel).toBe(2);
    expect(state.shotsRemaining).toBe(15);
  });

  it('should apply extra shot upgrade', () => {
    const upgrade: Upgrade = {
      id: 'extra_shot',
      name: 'Extra Shot',
      description: 'Get +1 shot',
      type: 'stat',
      value: 1
    };
    
    manager.applyUpgrade(upgrade);
    expect(manager.getState().shotsRemaining).toBe(16);
  });

  it('should apply score boost upgrade', () => {
    const upgrade: Upgrade = {
      id: 'score_boost',
      name: 'Score Boost',
      description: 'Score +20%',
      type: 'multiplier',
      value: 1.2
    };
    
    manager.applyUpgrade(upgrade);
    expect(manager.getState().scoreMultiplier).toBe(1.2);
  });

  it('should serialize and deserialize state', () => {
    manager.addScore(100);
    manager.useShot();
    manager.incrementCombo(1000);
    
    const serialized = manager.serialize();
    const newManager = new GameStateManager(mockLevelConfigs);
    newManager.deserialize(serialized);
    
    const state = newManager.getState();
    expect(state.score).toBe(100);
    expect(state.shotsRemaining).toBe(14);
    expect(state.combo).toBe(1);
  });

  it('should reset to initial state', () => {
    manager.addScore(100);
    manager.useShot();
    manager.reset();
    
    const state = manager.getState();
    expect(state.score).toBe(0);
    expect(state.shotsRemaining).toBe(15);
    expect(state.currentLevel).toBe(1);
  });
});
