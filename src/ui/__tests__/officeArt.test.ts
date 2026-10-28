import { describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type Phaser from 'phaser';
import { officeObstacle } from '../officeArt';
import classic from '../../config/levelConfig.json';
import shadows from '../../config/afterimageLevels.json';

vi.mock('phaser', () => ({ default: {} }));

describe('office obstacle geometry', () => {
  it('uses existing circular and rectangular artwork for every authored obstacle', () => {
    const stages = [...classic, ...shadows];
    for (let i = 0; i < stages.length; i++) {
      const obstacles = stages[i].obstacles;
      for (let j = 0; j < obstacles.length; j++) {
        const obstacle = obstacles[j];
        const circular = 'radius' in obstacle && obstacle.radius;
        expect(circular ? ['clock', 'coaster'] : ['ruler', 'notebook']).toContain(obstacle.skin);
        expect(existsSync(join(__dirname, '../../../assets/office', `${obstacle.skin}.webp`))).toBe(true);
      }
    }
  });

  it('keeps images on the exact configured collision center, dimensions and angle', () => {
    const image = { setDisplaySize: vi.fn().mockReturnThis(), setRotation: vi.fn().mockReturnThis() };
    const add = { image: vi.fn(() => image) };
    const scene = { add } as unknown as Phaser.Scene;
    officeObstacle(scene, { x: 520, y: 1050, width: 310, height: 18, angle: -0.24, skin: 'ruler' });
    expect(add.image).toHaveBeenLastCalledWith(520, 1050, 'office-ruler');
    expect(image.setDisplaySize).toHaveBeenLastCalledWith(310, 18);
    expect(image.setRotation).toHaveBeenLastCalledWith(-0.24);
    officeObstacle(scene, { x: 360, y: 480, radius: 38, skin: 'clock' });
    expect(add.image).toHaveBeenLastCalledWith(360, 480, 'office-clock');
    expect(image.setDisplaySize).toHaveBeenLastCalledWith(76, 76);
  });

  it('falls back to a matching silhouette if a skin has the wrong shape', () => {
    const image = { setDisplaySize: vi.fn().mockReturnThis() };
    const add = { image: vi.fn(() => image) };
    officeObstacle({ add } as unknown as Phaser.Scene, { x: 1, y: 2, radius: 30, skin: 'ruler' });
    expect(add.image).toHaveBeenCalledWith(1, 2, 'office-coaster');
  });
});
