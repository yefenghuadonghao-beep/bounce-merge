/** 成对出球减少纯随机死局，同时保留下一球的规划空间。 */
export class ShotQueue {
  private bag: number[] = [];
  private queue: number[];
  private cursor = 0;

  constructor(private baseLevel: number, private maxLevel: number, private random = Math.random, private sequence: readonly number[] = []) {
    this.queue = sequence.length > 0 ? [this.draw(), this.draw(), this.draw()] : [baseLevel, baseLevel, this.draw()];
  }

  peek(): readonly number[] {
    return [...this.queue];
  }

  /** 不分配数组的读取，供每帧调用：0 为当前球，1 为下一球。 */
  at(index: number): number {
    return this.queue[index];
  }

  take(): number {
    const level = this.queue.shift()!;
    this.queue.push(this.draw());
    return level;
  }

  swap(index = 1): void {
    if (index < 1 || index > 2) return;
    [this.queue[0], this.queue[index]] = [this.queue[index], this.queue[0]];
  }

  rotate(): void {
    this.queue.push(this.queue.shift()!);
  }

  private draw(): number {
    // 固定序列用于关卡解题，额外发射按同一顺序循环补齐。
    if (this.sequence.length > 0) return this.sequence[this.cursor++ % this.sequence.length];
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
