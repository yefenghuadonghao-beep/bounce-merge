import { GameState, Upgrade, LevelConfig } from '../types';

export class GameStateManager {
  private state: GameState;
  private levelConfigs: LevelConfig[];

  constructor(levelConfigs: LevelConfig[]) {
    this.levelConfigs = levelConfigs;
    this.state = this.createInitialState();
  }

  private createInitialState(): GameState {
    return {
      currentLevel: 1,
      score: 0,
      highestBallLevel: 1,
      shotsRemaining: this.levelConfigs[0]?.shots || 15,
      combo: 0,
      comboTimer: 0,
      upgrades: [],
      scoreMultiplier: 1,
      startingBallLevel: 1,
      wallBounceScore: 0,
      mergeChainBonus: 0,
      ballSizeMultiplier: 1
    };
  }

  getState(): GameState {
    return { ...this.state };
  }

  setState(state: GameState): void {
    this.state = { ...state };
  }

  addScore(points: number): number {
    const score = Math.floor(points * this.state.scoreMultiplier);
    this.state.score += score;
    return score;
  }

  recordMerge(level: number): void {
    this.state.highestBallLevel = Math.max(this.state.highestBallLevel, level);
  }

  incrementCombo(currentTime: number): void {
    this.state.combo++;
    this.state.comboTimer = currentTime;
  }

  resetCombo(): void {
    this.state.combo = 0;
  }

  checkComboExpired(currentTime: number, decayTime: number): boolean {
    if (this.state.combo > 0 && currentTime - this.state.comboTimer > decayTime) {
      this.resetCombo();
      return true;
    }
    return false;
  }

  useShot(): void {
    this.state.shotsRemaining = Math.max(0, this.state.shotsRemaining - 1);
  }

  getLevelConfig(): LevelConfig {
    const config = this.levelConfigs.find(l => l.level === this.state.currentLevel);
    if (config) return config;

    const last = this.levelConfigs[this.levelConfigs.length - 1];
    const extraLevels = this.state.currentLevel - last.level;
    return { ...last, level: this.state.currentLevel, targetScore: Math.ceil(last.targetScore * Math.pow(1.5, extraLevels)) };
  }

  hasReachedTarget(): boolean {
    const config = this.getLevelConfig();
    if (config.targetBallLevel) return this.state.highestBallLevel >= config.targetBallLevel;
    return this.state.score >= config.targetScore;
  }

  hasFailedLevel(): boolean {
    return this.state.shotsRemaining <= 0 && !this.hasReachedTarget();
  }

  advanceLevel(): void {
    this.state.currentLevel++;
    const config = this.getLevelConfig();
    const extraShots = this.state.upgrades.reduce((total, upgrade) => {
      return total + (upgrade.id === 'extra_shot' ? upgrade.value : 0);
    }, 0);
    this.state.shotsRemaining = config.shots + extraShots;
    this.resetCombo();
    this.state.highestBallLevel = 1;
    this.state.comboTimer = 0;
  }

  applyUpgrade(upgrade: Upgrade): void {
    this.state.upgrades.push(upgrade);

    switch (upgrade.id) {
      case 'extra_shot':
        this.state.shotsRemaining += upgrade.value;
        break;
      case 'score_boost':
        this.state.scoreMultiplier *= upgrade.value;
        break;
      case 'wall_bounce_score':
        this.state.wallBounceScore += upgrade.value;
        break;
      case 'merge_chain_bonus':
        this.state.mergeChainBonus += upgrade.value;
        break;
      case 'starting_level_boost':
        this.state.startingBallLevel += upgrade.value;
        break;
      case 'bigger_balls':
        this.state.ballSizeMultiplier = Math.min(1.6, this.state.ballSizeMultiplier * upgrade.value);
        break;
    }
  }

  reset(): void {
    this.state = this.createInitialState();
  }

  serialize(): string {
    return JSON.stringify(this.state);
  }

  deserialize(data: string): void {
    try {
      this.state = JSON.parse(data);
    } catch (e) {
      console.error('Failed to deserialize game state', e);
    }
  }
}
