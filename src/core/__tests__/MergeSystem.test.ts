import { describe, it, expect, beforeEach } from 'vitest';
import { MergeSystem } from '../MergeSystem';
import { BallLevel } from '../../types';

const mockBallLevels: BallLevel[] = [
  { level: 1, radius: 12, color: 0xff6b6b, score: 10 },
  { level: 2, radius: 14, color: 0xfeca57, score: 25 },
  { level: 3, radius: 16, color: 0x48dbfb, score: 50 },
  { level: 4, radius: 18, color: 0x1dd1a1, score: 100 },
  { level: 5, radius: 20, color: 0xee5a6f, score: 200 }
];

describe('MergeSystem', () => {
  let system: MergeSystem;

  beforeEach(() => {
    system = new MergeSystem(mockBallLevels);
  });

  it('should get ball config by level', () => {
    const config = system.getBallConfig(1);
    expect(config).toBeDefined();
    expect(config?.level).toBe(1);
    expect(config?.score).toBe(10);
  });

  it('should return undefined for invalid level', () => {
    const config = system.getBallConfig(99);
    expect(config).toBeUndefined();
  });

  it('should allow merge of same level balls', () => {
    expect(system.canMerge(1, 1)).toBe(true);
    expect(system.canMerge(3, 3)).toBe(true);
  });

  it('should not allow merge of different level balls', () => {
    expect(system.canMerge(1, 2)).toBe(false);
    expect(system.canMerge(2, 3)).toBe(false);
  });

  it('should not allow merge at max level', () => {
    expect(system.canMerge(5, 5)).toBe(false);
  });

  it('should calculate base merge score', () => {
    const score = system.calculateMergeScore(2, 1, 1.5, 0);
    expect(score).toBe(25);
  });

  it('should apply combo multiplier', () => {
    const score = system.calculateMergeScore(2, 2, 1.5, 0);
    expect(score).toBe(Math.floor(25 * 1.5));
  });

  it('should apply chain bonus', () => {
    const score = system.calculateMergeScore(2, 3, 1.5, 50);
    const expected = Math.floor(25 * Math.pow(1.5, 2) + 50 * 2);
    expect(score).toBe(expected);
  });

  it('should calculate complex combo score', () => {
    const score = system.calculateMergeScore(4, 4, 1.5, 50);
    const expected = Math.floor(100 * Math.pow(1.5, 3) + 50 * 3);
    expect(score).toBe(expected);
  });

  it('should return max level', () => {
    expect(system.getMaxLevel()).toBe(5);
  });

  it('should return 0 for invalid level in score calculation', () => {
    const score = system.calculateMergeScore(99, 1, 1.5, 0);
    expect(score).toBe(0);
  });
});
