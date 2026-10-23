import { describe, expect, it } from 'vitest';
import { ShotQueue } from '../ShotQueue';
import { GameController } from '../GameController';
import balls from '../../config/ballLevels.json';
import levels from '../../config/levelConfig.json';
import config from '../../config/gameConfig.json';

describe('fruit challenge rules', () => {
  it('opens with a predictable pair and never generates above the permitted level', () => {
    const queue = new ShotQueue(2, 3, () => 0.25);
    expect(queue.take()).toBe(2);
    expect(queue.take()).toBe(2);
    const draws = Array.from({ length: 12 }, () => queue.take());
    expect(draws.filter(level => level === 2)).toHaveLength(6);
    expect(draws.every(level => level >= 2 && level <= 3)).toBe(true);
  });

  it('swaps current and next without consuming a shot or losing fruit', () => {
    const queue = new ShotQueue(1, 2, () => 0);
    queue.take();
    queue.take();
    const before = queue.peek();
    queue.swap();
    expect(queue.peek()).toEqual([before[1], before[0], before[2]]);
  });

  it('wins the first level by making a strawberry rather than reaching 500 points', () => {
    const controller = new GameController(balls, levels, config);
    controller.processMerge(1, 1000);
    expect(controller.checkLevelComplete()).toBe('continue');
    controller.processMerge(2, 1500);
    expect(controller.getGameState().score).toBeLessThan(500);
    expect(controller.checkLevelComplete()).toBe('win');
    controller.advanceLevel();
    expect(controller.checkLevelComplete()).toBe('continue');
    expect(controller.getGameState().highestBallLevel).toBe(1);
  });
});
