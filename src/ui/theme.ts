import Phaser from 'phaser';

export const fruitNames = ['', '蓝莓', '樱桃', '草莓', '青柠', '橙子', '桃子', '苹果', '椰子', '西瓜', '星星果'];
export const ink = '#513960';

export function panel(scene: Phaser.Scene, x: number, y: number, width: number, height: number, color = 0xfff8ef) {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x513960, 0.12).fillRoundedRect(x, y + 6, width, height, 24);
  graphics.fillStyle(color, 0.96).fillRoundedRect(x, y, width, height, 24);
  graphics.lineStyle(2, 0xffffff, 0.9).strokeRoundedRect(x, y, width, height, 24);
  return graphics;
}

export function button(scene: Phaser.Scene, x: number, y: number, width: number, title: string, action: () => void) {
  const container = scene.add.container(x, y);
  const bg = scene.add.graphics();
  bg.fillStyle(0x5c387a).fillRoundedRect(-width / 2, -35, width, 76, 22);
  bg.fillStyle(0x8a59b2).fillRoundedRect(-width / 2, -40, width, 76, 22);
  const label = scene.add.text(0, -3, title, { fontSize: '25px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
  container.add([bg, label]).setSize(width, 80).setInteractive({ useHandCursor: true });
  container.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation();
    action();
  });
  return { container, label };
}
