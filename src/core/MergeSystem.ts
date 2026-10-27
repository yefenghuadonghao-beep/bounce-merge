import { BallLevel } from '../types';

export class MergeSystem {
  private ballLevels: BallLevel[];

  constructor(ballLevels: BallLevel[]) {
    this.ballLevels = ballLevels;
  }

  getBallConfig(level: number): BallLevel | undefined {
    return this.ballLevels.find(b => b.level === level);
  }

  canMerge(level1: number, level2: number): boolean {
    return level1 === level2 && level1 < this.ballLevels.length;
  }

  calculateMergeScore(level: number, combo: number, comboMultiplier: number, chainBonus: number): number {
    const config = this.getBallConfig(level);
    if (!config) return 0;

    let score = config.score;
    
    if (combo > 1) {
      score *= Math.pow(comboMultiplier, Math.min(combo - 1, 7));
      score += chainBonus * (combo - 1);
    }

    return Math.floor(score);
  }

  getMaxLevel(): number {
    return this.ballLevels.length;
  }
}
