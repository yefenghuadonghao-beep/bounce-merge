import { describe, expect, it } from 'vitest';
import levels from '../../config/levelConfig.json';
import balls from '../../config/ballLevels.json';
import solutions from '../../../scripts/chapter-solutions.json';
import { simulateStage } from '../../../scripts/simulate-chapter';

describe('chapter one authored maps', () => {
  it('contains eight distinct authored levels with finite shot budgets', () => {
    expect(levels).toHaveLength(8);
    expect(new Set(levels.map(stage => stage.title)).size).toBe(8);
    expect(levels.filter(stage => stage.chapterEnd).map(stage => stage.level)).toEqual([8]);
    for (let i = 0; i < levels.length; i++) {
      const stage = levels[i];
      expect(stage.shotSequence).toHaveLength(stage.shots);
      expect(stage.shotSequence.every(level => level >= 1 && level < stage.targetBallLevel)).toBe(true);
      const mass = [...stage.shotSequence, ...stage.presetBalls.map(ball => ball.level)].reduce((total, level) => total + 2 ** (level - 1), 0);
      expect(mass).toBeGreaterThanOrEqual(2 ** (stage.targetBallLevel - 1));
      for (let j = 0; j < stage.presetBalls.length; j++) {
        const seed = stage.presetBalls[j];
        const radius = balls[seed.level - 1].radius;
        expect(seed.level).toBeLessThan(stage.targetBallLevel);
        expect(seed.x - radius).toBeGreaterThan(55);
        expect(seed.x + radius).toBeLessThan(665);
        expect(seed.y + radius).toBeLessThan(1100);
        for (let k = 0; k < j; k++) {
          const other = stage.presetBalls[k];
          expect(Math.hypot(seed.x - other.x, seed.y - other.y)).toBeGreaterThan(radius + balls[other.level - 1].radius);
        }
      }
    }
  });

  for (let i = 0; i < solutions.length; i++) {
    const solution = solutions[i];
    it(`stage ${solution.stage} has a physics-verified solution without upgrades`, () => {
      const result = simulateStage(solution.stage, solution.angles, solution.rescue);
      expect(result.won).toBe(true);
      expect(result.autoWin).toBe(false);
      expect(result.shots).toBeLessThanOrEqual(levels[solution.stage - 1].shots);
    });
    it(`stage ${solution.stage} never completes while idle`, () => {
      expect(simulateStage(solution.stage, [])).toMatchObject({ won: false, merges: 0 });
    });
  }

  it('the coffee break requires planning beyond the first shot', () => {
    expect(simulateStage(4, [0.3])).toMatchObject({ won: false, shots: 1 });
  });
  it('the final three levels cannot be cleared by firing straight down', () => {
    for (let stage = 6; stage <= 8; stage++) {
      expect(simulateStage(stage, Array(levels[stage - 1].shots).fill(Math.PI / 2)).won).toBe(false);
    }
  });
  it('the limited-shot challenge does not reward center-only firing without rescue', () => {
    expect(simulateStage(7, Array(levels[6].shots).fill(Math.PI / 2)).won).toBe(false);
  });
});
