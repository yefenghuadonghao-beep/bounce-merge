import Phaser from 'phaser';

// 特效只绘制独立外观，不修改团子或机关的物理尺寸。
export function mergeBurst(scene: Phaser.Scene, x: number, y: number, color: number, combo: number, shadow: boolean) {
  const radius = Math.min(78, 42 + combo * 6);
  const ring = scene.add.circle(x, y, 12, 0xfff8dd, 0.2).setStrokeStyle(4, color, 0.8).setDepth(6);
  scene.tweens.add({ targets: ring, radius, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  const count = combo >= 3 ? 10 : 6;
  for (let i = 0; i < count; i++) {
    const angle = Math.PI * 2 * i / count;
    const spark = scene.add.graphics().setPosition(x, y).setDepth(6);
    spark.lineStyle(2, shadow ? 0x8fae8b : 0xd4a363, 1);
    spark.lineBetween(-5, 0, 5, 0).lineBetween(0, -5, 0, 5);
    scene.tweens.add({ targets: spark, x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius, alpha: 0, angle: 70, duration: 470, ease: 'Cubic.easeOut', onComplete: () => spark.destroy() });
  }
  if (shadow || combo >= 3) {
    const echo = scene.add.circle(x, y, 16, color, 0).setStrokeStyle(2, shadow ? 0x8fae8b : 0xe6bd72, 0.7).setDepth(6);
    scene.tweens.add({ targets: echo, radius: radius * 1.25, alpha: 0, delay: 100, duration: 460, onComplete: () => echo.destroy() });
  }
}

export function paperConfetti(scene: Phaser.Scene, root: Phaser.GameObjects.Container) {
  const colors = [0xe7ad76, 0xa8bc8d, 0xe8cf89, 0xf6e6c2];
  for (let i = 0; i < 22; i++) {
    const left = i % 2 === 0;
    const x = left ? 100 : 620;
    const paper = scene.add.rectangle(x, 580, 7 + i % 4, 13, colors[i % colors.length]).setAngle(i * 31);
    root.add(paper);
    scene.tweens.add({ targets: paper, x: 110 + (i * 83) % 500, y: 320 + (i * 67) % 450, angle: paper.angle + 180, duration: 650 + i * 17, ease: 'Cubic.easeOut', onComplete: () => {
      scene.tweens.add({ targets: paper, y: paper.y + 120, alpha: 0, angle: paper.angle + 90, duration: 650, onComplete: () => paper.destroy() });
    } });
  }
}
