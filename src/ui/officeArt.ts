import Phaser from 'phaser';
import { assetUrl } from '../platform/assets';
import type { BoardObstacle } from '../types';
import { FONT_FAMILY } from './theme';
import characterAtlas from '../config/characterAtlas.json';

export const itemFrames = { document: 1, coffee: 2, package: 3, keyboard: 4, mouse: 5, plant: 6 };

export function loadOfficeArt(scene: Phaser.Scene) {
  const materials = ['ruler', 'notebook', 'coaster', 'clock'];
  for (let i = 0; i < materials.length; i++) {
    const key = `office-${materials[i]}`;
    if (!scene.textures.exists(key)) scene.load.image(key, assetUrl(`assets/office/${materials[i]}.webp`));
  }
  if (!scene.textures.exists('office-room')) scene.load.image('office-room', assetUrl('assets/office/room.webp'));
  if (!scene.textures.exists('office-props')) scene.load.image('office-props', assetUrl('assets/office/props.png'));
  if (!scene.textures.exists('characters')) scene.load.atlas('characters', assetUrl('assets/characters/office-mochi.png'), characterAtlas);
}

export function officeProp(scene: Phaser.Scene, x: number, y: number, frame: number, size: number) {
  const texture = scene.textures.get('office-props');
  const source = texture.getSourceImage();
  const width = source.width / 4;
  const height = source.height / 2;
  if (!texture.has(String(frame))) texture.add(String(frame), 0, (frame % 4) * width, Math.floor(frame / 4) * height, width, height);
  return scene.add.image(x, y, 'office-props', String(frame)).setDisplaySize(size, size);
}

// 贴图裁掉透明留白，显示边界始终与物理几何共用配置。
export function officeObstacle(scene: Phaser.Scene, obstacle: BoardObstacle) {
  let skin = obstacle.skin;
  const allowed = obstacle.radius ? ['coaster', 'clock'] : ['ruler', 'notebook'];
  if (!skin || !allowed.includes(skin)) skin = allowed[0];
  const image = scene.add.image(obstacle.x, obstacle.y, `office-${skin}`);
  if (obstacle.radius) return image.setDisplaySize(obstacle.radius * 2, obstacle.radius * 2);
  return image.setDisplaySize(obstacle.width ?? 100, obstacle.height ?? 18).setRotation(obstacle.angle ?? 0);
}

// 机关标识和贴图一起缩放，关卡预览与实战共用同一套视觉。
export function officeMechanism(scene: Phaser.Scene, obstacle: BoardObstacle, scale = 1) {
  const image = officeObstacle(scene, { ...obstacle, x: 0, y: 0 });
  const container = scene.add.container(obstacle.x, obstacle.y, [image]);
  if (!obstacle.mechanic) return container;
  let title = `撞 ${obstacle.hits ?? 1} 次`;
  let color = 0xf2b987;
  if (obstacle.mechanic === 'switch') {
    title = `${obstacle.link} · 开门`;
    color = 0xc5dca5;
  }
  if (obstacle.mechanic === 'gate') {
    title = `${obstacle.link} · 门禁`;
    color = 0xc5dca5;
  }
  const offset = (obstacle.radius ?? (obstacle.height ?? 18) / 2) + 18 * scale;
  const label = scene.add.text(0, offset, title, { fontFamily: FONT_FAMILY, fontSize: `${19 * scale}px`, color: '#49392d', backgroundColor: obstacle.mechanic === 'breakable' ? '#ffe0b9' : '#e4f0cf', padding: { x: 7 * scale, y: 3 * scale } }).setOrigin(0.5).setName('mechanism-label');
  const glow = scene.add.graphics().lineStyle(3 * scale, color, 0.9);
  if (obstacle.radius) glow.strokeCircle(0, 0, obstacle.radius + 3 * scale);
  else glow.strokeRoundedRect(-(obstacle.width ?? 100) / 2, -(obstacle.height ?? 18) / 2 - 3 * scale, obstacle.width ?? 100, (obstacle.height ?? 18) + 6 * scale, 4 * scale).setRotation(obstacle.angle ?? 0);
  container.add([glow, label]);
  return container;
}
