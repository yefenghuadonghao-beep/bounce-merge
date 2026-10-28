import Phaser from 'phaser';
import { assetUrl } from '../platform/assets';
import type { BoardObstacle } from '../types';
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
