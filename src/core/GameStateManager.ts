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

  addScore(points: number): void {
    this.state.score += Math.floor(points * this.state.scoreMultiplier);
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
    this.state.shotsRemaining--;
  }

  getLevelConfig(): LevelConfig {
    const config = this.levelConfigs.find(l => l.level === this.state.currentLevel);
    return config || this.levelConfigs[this.levelConfigs.length - 1];
  }

  hasReachedTarget(): boolean {
    const config = this.getLevelConfig();
    return this.state.score >= config.targetScore;
  }

  hasFailedLevel(): boolean {
    const config = this.getLevelConfig();
    return this.state.shotsRemaining <= 0 && this.state.score < config.targetScore;
  }

  advanceLevel(): void {
    this.state.currentLevel++;
    const config = this.getLevelConfig();
    this.state.shotsRemaining = config.shots;
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
        this.state.wallBounceScore = upgrade.value;
        break;
      case 'merge_chain_bonus':
        this.state.mergeChainBonus = upgrade.value;
        break;
      case 'starting_level_boost':
        this.state.startingBallLevel += upgrade.value;
        break;
      case 'bigger_balls':
        this.state.ballSizeMultiplier *= upgrade.value;
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
