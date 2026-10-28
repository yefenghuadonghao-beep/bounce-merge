import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { boardPreview } from '../boardPreview';
import { officeMechanism } from '../officeArt';

vi.mock('../officeArt', () => ({ officeMechanism: vi.fn() }));

describe('board preview geometry', () => {
  it('keeps the same scale for centers, widths, heights and circles', () => {
    const graphics = { fillStyle: vi.fn().mockReturnThis(), fillRoundedRect: vi.fn().mockReturnThis(), lineStyle: vi.fn().mockReturnThis(), lineBetween: vi.fn().mockReturnThis(), fillCircle: vi.fn().mockReturnThis() };
    const scene = { add: { graphics: () => graphics } } as unknown as Phaser.Scene;
    boardPreview(scene, { level: 8, shots: 8, targetScore: 0, obstacles: [
      { x: 360, y: 480, radius: 38 },
      { x: 360, y: 700, width: 220, height: 18, angle: 0.24 }
    ] }, 100, 200, 360, 450);
    expect(officeMechanism).toHaveBeenNthCalledWith(1, scene, expect.objectContaining({ x: 280, y: 330, radius: 19 }), 0.5);
    expect(officeMechanism).toHaveBeenNthCalledWith(2, scene, expect.objectContaining({ x: 280, y: 440, width: 110, height: 9, angle: 0.24 }), 0.5);
    expect(graphics.fillCircle).toHaveBeenCalledWith(280, 225, 9);
  });
});
