/** 合成充能奖励救场，每关最多三次，避免无限续杯。 */
export class MergeCharge {
  charge = 0;
  rewards = 0;
  readonly threshold = 4;
  readonly limit = 3;

  add(combo: number): boolean {
    if (this.rewards >= this.limit) return false;
    this.charge += combo >= 3 ? 2 : 1;
    if (this.charge < this.threshold) return false;
    this.charge -= this.threshold;
    this.rewards++;
    return true;
  }
}
