import Phaser from 'phaser';
import { assetUrl } from '../platform/assets';
import characterAtlas from '../config/characterAtlas.json';

export const itemFrames = { document: 1, coffee: 2, package: 3, keyboard: 4, mouse: 5, plant: 6 };

export function loadOfficeArt(scene: Phaser.Scene) {
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
