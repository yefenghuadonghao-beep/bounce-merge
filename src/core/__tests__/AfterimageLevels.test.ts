import { describe, it, expect } from 'vitest';
import { GameController } from '../GameController';
import levels from '../../config/afterimageLevels.json';
import classic from '../../config/levelConfig.json';
import balls from '../../config/ballLevels.json';
import config from '../../config/gameConfig.json';

describe('残影模式关卡隔离', () => {
  it('切换模式时重置关卡、分数、发射队列与重试检查点', () => {
    const controller = new GameController(balls, classic, config);
    controller.processMerge(2, 100);
    controller.advanceLevel();
    controller.startRun(levels);
    expect(controller.getLevelCount()).toBe(4);
    expect(controller.getGameState()).toMatchObject({ currentLevel: 1, score: 0, shotsRemaining: 12 });
    expect(controller.getLevelConfig().shotSequence).toEqual(levels[0].shotSequence);
    controller.useShot();
    controller.retryLevel();
    expect(controller.getGameState().shotsRemaining).toBe(12);
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
      expect(level.shotSequence.slice(0, 4)).toEqual(Array(4).fill(i + 1));
      expect(level.targetBallLevel).toBe(i + 3);
      expect(level.presetBalls).toEqual([]);
    }
  });
});
