import { describe, it, expect } from 'vitest';
import { GameController } from '../GameController';
import levels from '../../config/afterimageLevels.json';
import classic from '../../config/levelConfig.json';
import balls from '../../config/ballLevels.json';
import config from '../../config/gameConfig.json';
import solutions from '../../../scripts/afterimage-solutions.json';
import { simulateStage } from '../../../scripts/simulate-chapter';

describe('残影模式关卡隔离', () => {
  it('切换模式时重置关卡、分数、发射队列与重试检查点', () => {
    const controller = new GameController(balls, classic, config);
    controller.processMerge(2, 100);
    controller.advanceLevel();
    controller.startRun(levels);
    expect(controller.getLevelCount()).toBe(4);
    expect(controller.getGameState()).toMatchObject({ currentLevel: 1, score: 0, shotsRemaining: levels[0].shots });
    expect(controller.getLevelConfig().shotSequence).toEqual(levels[0].shotSequence);
    controller.useShot();
    controller.retryLevel();
    expect(controller.getGameState().shotsRemaining).toBe(levels[0].shots);
    controller.startRun(classic);
    expect(controller.getLevelCount()).toBe(8);
    expect(controller.getLevelConfig()).toEqual(classic[0]);
  });

  it('每轮提供成对弹珠体验共鸣，地图和目标逐轮变化', () => {
    expect(new Set(levels.map(level => JSON.stringify(level.obstacles))).size).toBe(4);
    expect(levels.filter(level => level.chapterEnd).map(level => level.level)).toEqual([4]);
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      expect(level.shotSequence).toHaveLength(level.shots);
      expect(level.requiredAfterimageMerges).toBe(i + 1);
      expect(level.shotSequence.every(ball => ball < level.targetBallLevel)).toBe(true);
      expect(level.targetBallLevel).toBe(i + 3);
      expect(level.presetBalls).toEqual([]);
    }
  });
  for (let i = 0; i < solutions.length; i++) {
    const solution = solutions[i];
    it(`残影第 ${solution.stage} 轮无需福利也有物理解法`, () => {
      const result = simulateStage(solution.stage, solution.angles, solution.rescue, true, '', solution.actions);
      expect(result.won).toBe(true);
      expect(result.shadowMerges).toBeGreaterThanOrEqual(levels[i].requiredAfterimageMerges);
      expect(result.shots).toBeLessThanOrEqual(levels[i].shots);
      expect(simulateStage(solution.stage, [], false, true).won).toBe(false);
    });
  }

});
