import Phaser from 'phaser';

export const characterNames = ['', '困困猫', '放空豚', '暴躁鼠', '续命蛙', '打卡汪', '发呆兔', '摸鱼熊', '躺平鹅', '溜了狐', '下班大王'];
export const ink = '#49392d';
// 设计区域外的留边颜色（网页 body 背景、小游戏全屏画布底色）。
export const letterboxColor = '#ded6c3';

// 全部文字统一用圆体子集（Resource Han Rounded CN，SIL OFL 1.1），系统字体兜底。
// 字体文件由 npm run font:subset 生成，启动时经平台层 loadFont 加载完成后才创建游戏。
export const FONT_NAME = 'MochiRounded';
const FALLBACK_FONTS = `'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif`;
// live binding：小游戏里 wx.loadFont 返回的字体名由字体文件决定（不一定是 FONT_NAME），
// 启动时用 setFontFamily 换成实际名字；场景都在 create() 里读取，拿到的是更新后的值。
export let FONT_FAMILY = `'${FONT_NAME}', ${FALLBACK_FONTS}`;
export function setFontFamily(primary: string): void {
  FONT_FAMILY = `'${primary.replace(/'/g, '')}', ${FALLBACK_FONTS}`;
}
export const FONT_FACES = [
  { weight: '400', file: 'mochi-rounded-regular' },
  { weight: '700', file: 'mochi-rounded-bold' }
] as const;

export function panel(scene: Phaser.Scene, x: number, y: number, width: number, height: number, color = 0xfffcf2) {
  const graphics = scene.add.graphics();
  graphics.fillStyle(0x49392d, 0.16).fillRoundedRect(x, y + 6, width, height, 24);
  graphics.fillStyle(color, 0.96).fillRoundedRect(x, y, width, height, 24);
  graphics.lineStyle(3, 0x49392d, 1).strokeRoundedRect(x, y, width, height, 24);
  return graphics;
}

export function button(scene: Phaser.Scene, x: number, y: number, width: number, title: string, action: () => void) {
  const container = scene.add.container(x, y);
  const bg = scene.add.graphics();
  bg.fillStyle(0x49392d).fillRoundedRect(-width / 2, -35, width, 76, 22);
  bg.fillStyle(0xee976e).fillRoundedRect(-width / 2, -40, width, 76, 22);
  const label = scene.add.text(0, -3, title, { fontFamily: FONT_FAMILY, fontSize: '25px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
  container.add([bg, label]).setSize(width, 80).setInteractive({ useHandCursor: true });
  container.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation();
    action();
  });
  return { container, label };
}

// 用纸张网格和贴纸建立统一场景，保持游玩区域干净。
export function paper(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(0xf4efdf).fillRect(0, 0, 720, 1280);
  g.lineStyle(1, 0xd9d1bc, 0.45);
  for (let x = 0; x < 720; x += 40) g.lineBetween(x, 0, x, 1280);
  for (let y = 0; y < 1280; y += 40) g.lineBetween(0, y, 720, y);
}
