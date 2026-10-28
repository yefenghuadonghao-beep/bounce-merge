import type Phaser from 'phaser';
import type { LevelConfig } from '../types';
import ballLevels from '../config/ballLevels.json';
import { officeObstacle } from './officeArt';

// 缩略图和展开图使用同一比例，机关角度、间距与预摆位置保持一致。
export function boardPreview(scene: Phaser.Scene, level: LevelConfig, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / 720, height / 900);
  const left = x + (width - 720 * scale) / 2;
  const top = y + (height - 900 * scale) / 2;
  const px = (value: number) => left + value * scale;
  const py = (value: number) => top + (value - 220) * scale;
  const g = scene.add.graphics();
  g.fillStyle(0xeee6d5).fillRoundedRect(left, top, 720 * scale, 900 * scale, 12);
  g.lineStyle(Math.max(1, 3 * scale), 0xc7b38f).lineBetween(px(50), py(1110), px(670), py(1110));
  const obstacles = level.obstacles ?? [];
  for (let i = 0; i < obstacles.length; i++) {
    const obstacle = obstacles[i];
    officeObstacle(scene, {
      ...obstacle,
      x: px(obstacle.x),
      y: py(obstacle.y),
      radius: obstacle.radius ? obstacle.radius * scale : undefined,
      width: (obstacle.width ?? 100) * scale,
      height: (obstacle.height ?? 18) * scale
    });
  }
  const seeds = level.presetBalls ?? [];
  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    const radius = ballLevels.find(ball => ball.level === seed.level)?.radius ?? 26;
    scene.add.image(px(seed.x), py(seed.y), 'characters', `ball_${seed.level}`).setDisplaySize(radius * 2 * scale, radius * 2 * scale);
  }
  g.fillStyle(0xee976e).fillCircle(px(360), py(270), Math.max(3, 18 * scale));
}
