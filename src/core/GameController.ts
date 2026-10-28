import { GameStateManager } from './GameStateManager';
import { MergeSystem } from './MergeSystem';
import { Upgrade, BallLevel, LevelConfig, GameConfig } from '../types';

export interface MergeEvent {
  level: number;
  x: number;
  y: number;
  score: number;
  combo: number;
}

export interface ScoreEvent {
  score: number;
  reason: 'merge' | 'wallBounce';
}

export class GameController {
  private summary = { merges: 0, bestCombo: 0, highest: 1 };
  private levelSummary = { score: 0, merges: 0, bestCombo: 0, highest: 1 };
  private levelCount = 0;
  private checkpoint = '';
  private checkpointSummary = { merges: 0, bestCombo: 0, highest: 1 };
  private gameState: GameStateManager;
  private mergeSystem: MergeSystem;
  private gameConfig: GameConfig;
  
  constructor(
    ballLevels: BallLevel[],
    levelConfigs: LevelConfig[],
    gameConfig: GameConfig
  ) {
    this.gameState = new GameStateManager(levelConfigs);
    this.levelCount = levelConfigs.length;
    this.mergeSystem = new MergeSystem(ballLevels);
    this.gameConfig = gameConfig;
    this.checkpoint = this.gameState.serialize();
  }

  startRun(levelConfigs: LevelConfig[]) {
    this.gameState = new GameStateManager(levelConfigs);
    this.levelCount = levelConfigs.length;
    this.reset();
  }

  getLevelCount() { return this.levelCount; }

  getGameState() {
    return this.gameState.getState();
  }

  getLevelConfig() {
    return this.gameState.getLevelConfig();
  }

  getNextLevelConfig() {
    return this.gameState.getLevelConfig(this.gameState.getState().currentLevel + 1);
  }

  getBallConfig(level: number) {
    return this.mergeSystem.getBallConfig(level);
  }

  useShot() {
    this.gameState.useShot();
  }

  canMerge(level1: number, level2: number): boolean {
    return this.mergeSystem.canMerge(level1, level2);
  }

  processMerge(level: number, currentTime: number): { score: number; newLevel: number } {
    this.gameState.recordMerge(level + 1);
    this.updateCombo(currentTime);
    this.gameState.incrementCombo(currentTime);
    const state = this.gameState.getState();
    
    const score = this.mergeSystem.calculateMergeScore(
      level + 1,
      state.combo,
      this.gameConfig.scoring.comboMultiplier,
      state.mergeChainBonus
    );
    
    const awardedScore = this.gameState.addScore(score);
    this.summary.merges++;
    this.summary.bestCombo = Math.max(this.summary.bestCombo, state.combo);
    this.summary.highest = Math.max(this.summary.highest, level + 1);
    this.levelSummary.score += awardedScore;
    this.levelSummary.merges++;
    this.levelSummary.bestCombo = Math.max(this.levelSummary.bestCombo, state.combo);
    this.levelSummary.highest = Math.max(this.levelSummary.highest, level + 1);
    
    return {
      score: awardedScore,
      newLevel: level + 1
    };
  }

  processWallBounce(): number {
    const state = this.gameState.getState();
    if (state.wallBounceScore > 0) {
      const score = this.gameState.addScore(state.wallBounceScore);
      this.levelSummary.score += score;
      return score;
    }
    return 0;
  }

  updateCombo(currentTime: number): boolean {
    return this.gameState.checkComboExpired(
      currentTime,
      this.gameConfig.scoring.comboDecayTime
    );
  }

  checkLevelComplete(): 'continue' | 'win' | 'lose' {
    if (this.gameState.hasReachedTarget()) {
      return 'win';
    }
    if (this.gameState.hasFailedLevel()) {
      return 'lose';
    }
    return 'continue';
  }

  advanceLevel() {
    this.gameState.advanceLevel();
    this.levelSummary = { score: 0, merges: 0, bestCombo: 0, highest: 1 };
    this.checkpoint = this.gameState.serialize();
    this.checkpointSummary = { ...this.summary };
  }

  applyUpgrade(upgrade: Upgrade) {
    this.gameState.applyUpgrade(upgrade);
  }

  getMaxBallLevel(): number {
    return this.mergeSystem.getMaxLevel();
  }

  retryLevel() {
    this.gameState.deserialize(this.checkpoint);
    this.summary = { ...this.checkpointSummary };
    this.levelSummary = { score: 0, merges: 0, bestCombo: 0, highest: this.gameState.getState().highestBallLevel };
  }

  getRunSummary() {
    return { ...this.summary };
  }

  getLevelSummary() {
    return { ...this.levelSummary };
  }

  reset() {
    this.summary = { merges: 0, bestCombo: 0, highest: 1 };
    this.levelSummary = { score: 0, merges: 0, bestCombo: 0, highest: 1 };
    this.gameState.reset();
    this.checkpoint = this.gameState.serialize();
    this.checkpointSummary = { ...this.summary };
  }

  save(): string {
    return this.gameState.serialize();
  }

  load(data: string) {
    this.gameState.deserialize(data);
    this.levelSummary = { score: 0, merges: 0, bestCombo: 0, highest: this.gameState.getState().highestBallLevel };
    this.checkpoint = this.gameState.serialize();
    this.checkpointSummary = { ...this.summary };
  }
}
