/** 成对出球减少纯随机死局，同时保留下一球的规划空间。 */
export class ShotQueue {
  private bag: number[] = [];
  private queue: number[];

  constructor(private baseLevel: number, private maxLevel: number, private random = Math.random) {
    this.queue = [baseLevel, baseLevel, this.draw()];
  }

  peek(): readonly number[] {
    return [...this.queue];
  }

  take(): number {
    const level = this.queue.shift()!;
    this.queue.push(this.draw());
    return level;
  }

  swap(): void {
    [this.queue[0], this.queue[1]] = [this.queue[1], this.queue[0]];
  }

  private draw(): number {
    if (this.bag.length === 0) {
      const higher = Math.min(this.baseLevel + 1, this.maxLevel);
      this.bag = [this.baseLevel, this.baseLevel, higher, higher];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop()!;
  }
}
