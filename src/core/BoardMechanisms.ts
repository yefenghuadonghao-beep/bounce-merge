import type { BoardObstacle } from '../types';

export class BoardMechanisms {
  private remaining: number[];
  private removed = new Set<number>();
  private activated = new Set<number>();
  private lastHit = new Map<number, number>();

  constructor(private obstacles: BoardObstacle[]) {
    this.remaining = obstacles.map(obstacle => Math.max(1, obstacle.hits ?? 1));
  }

  // 只接受真实运动的撞击，静置和同一物理接触不消耗耐久。
  hit(index: number, speed: number, time: number) {
    const obstacle = this.obstacles[index];
    const removed: number[] = [];
    if (!obstacle || this.removed.has(index) || this.activated.has(index) || speed < 2.5 || time - (this.lastHit.get(index) ?? -Infinity) < 250) return { changed: false, removed, remaining: this.remaining[index] };
    if (obstacle.mechanic !== 'breakable' && obstacle.mechanic !== 'switch') return { changed: false, removed, remaining: this.remaining[index] };
    this.lastHit.set(index, time);
    if (obstacle.mechanic === 'breakable') {
      this.remaining[index]--;
      if (this.remaining[index] === 0) removed.push(index);
    } else {
      this.activated.add(index);
      for (let i = 0; i < this.obstacles.length; i++) {
        const gate = this.obstacles[i];
        if (obstacle.link && gate.mechanic === 'gate' && gate.link === obstacle.link && !this.removed.has(i)) removed.push(i);
      }
    }
    for (let i = 0; i < removed.length; i++) this.removed.add(removed[i]);
    return { changed: true, removed, remaining: this.remaining[index] };
  }
}
