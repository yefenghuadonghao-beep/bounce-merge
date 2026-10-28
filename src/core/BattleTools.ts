// 聚拢点限制在收纳区内，保留足够空间让大团子相碰。
export function gatherVelocity(x: number, targetX = 360) {
  const target = Math.max(120, Math.min(600, targetX));
  return { x: (target - x) * 0.025, y: -7 };
}
