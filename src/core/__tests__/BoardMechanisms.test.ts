import { describe, expect, it } from 'vitest';
import { BoardMechanisms } from '../BoardMechanisms';
import levels from '../../config/levelConfig.json';
import { simulateStage } from '../../../scripts/simulate-chapter';
import solutions from '../../../scripts/chapter-solutions.json';
import type { BoardObstacle } from '../../types';

describe('office board mechanisms', () => {
  it('requires separate moving impacts and removes a two-hit shelf only once', () => {
    const board = new BoardMechanisms([{ x: 0, y: 0, mechanic: 'breakable', hits: 2 }]);
    expect(board.hit(0, 0.2, 0).changed).toBe(false);
    expect(board.hit(0, 8, 10)).toMatchObject({ changed: true, remaining: 1, removed: [] });
    expect(board.hit(0, 8, 20).changed).toBe(false);
    expect(board.hit(0, 8, 500).removed).toEqual([0]);
    expect(board.hit(0, 8, 1000).changed).toBe(false);
  });

  it('opens all matching gates once while unrelated gates and solid walls remain', () => {
    const board = new BoardMechanisms([
      { x: 0, y: 0, mechanic: 'switch', link: 'A' },
      { x: 0, y: 0, mechanic: 'gate', link: 'A' },
      { x: 0, y: 0, mechanic: 'gate', link: 'B' },
      { x: 0, y: 0 },
      { x: 0, y: 0, mechanic: 'gate', link: 'A' }
    ]);
    expect(board.hit(3, 12, 0).changed).toBe(false);
    expect(board.hit(1, 12, 0).changed).toBe(false);
    expect(board.hit(0, 12, 0).removed).toEqual([1, 4]);
    expect(board.hit(0, 12, 500).changed).toBe(false);
    expect(board.hit(2, 12, 500).changed).toBe(false);
  });

  it('resets durability and gates for a fresh attempt', () => {
    const obstacles = [{ x: 0, y: 0, mechanic: 'breakable' }];
    const first = new BoardMechanisms(obstacles);
    first.hit(0, 8, 0);
    expect(new BoardMechanisms(obstacles).hit(0, 8, 0).removed).toEqual([0]);
    expect(obstacles[0]).not.toHaveProperty('hits');
  });

  it('introduces mechanisms after the warmup and every gate has a matching linked switch', () => {
    for (let i = 0; i < 3; i++) expect(levels[i].obstacles.some(o => 'mechanic' in o)).toBe(false);
    for (let i = 3; i < levels.length; i++) {
      expect(levels[i].obstacles.some(o => 'mechanic' in o)).toBe(true);
      const obstacles: BoardObstacle[] = levels[i].obstacles;
      const gates = obstacles.filter(o => o.mechanic === 'gate');
      for (let j = 0; j < gates.length; j++) expect(obstacles.some(o => o.mechanic === 'switch' && o.link === gates[j].link)).toBe(true);
    }
  });

  it('a real shot through the switch opens its linked gate, while idle never opens it', () => {
    expect(simulateStage(5, []).mechanismsRemoved).toBe(0);
    expect(simulateStage(5, [2.35]).mechanismsRemoved).toBe(1);
  });

  it('the release-bridge solution breaks the support and still reaches its merge goal', () => {
    const solution = solutions[5];
    expect(simulateStage(6, solution.angles, true)).toMatchObject({ won: true, mechanismsRemoved: 1 });
  });

  it('the introductory shelf can really be broken by a shot and never by waiting', () => {
    expect(simulateStage(4, []).mechanismsRemoved).toBe(0);
    expect(simulateStage(4, [Math.PI / 2 + 0.25]).mechanismsRemoved).toBeGreaterThan(0);
  });
});
