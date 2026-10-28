import Phaser from 'phaser';
import classicLevels from '../config/levelConfig.json';
import afterimageLevels from '../config/afterimageLevels.json';
import { GameController } from '../core/GameController';
import { GameConfig } from '../types';
import { button, ink, panel, paper, FONT_FAMILY, characterNames } from '../ui/theme';
import { setupHiDpi } from '../ui/hidpi';
import { loadOfficeArt } from '../ui/officeArt';

export class HomeScene extends Phaser.Scene {
  private gameController!: GameController;
  private gameConfig!: GameConfig;

  constructor() { super({ key: 'HomeScene' }); }

  init(data: { gameController: GameController; gameConfig: GameConfig }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
  }

  preload() { loadOfficeArt(this); }

  create() {
    setupHiDpi(this);
    paper(this);
    this.add.image(360, 410, 'office-room').setDisplaySize(720, 820);
    this.add.rectangle(360, 146, 720, 292, 0xf5eddb);
    this.add.text(42, 48, 'MOCHI OFFICE  /  下班事务所', { fontFamily: FONT_FAMILY, fontSize: '19px', color: '#6d795a' });
    this.add.text(42, 94, '今天，也要\n准点下班。', { fontFamily: FONT_FAMILY, fontSize: '62px', color: ink, fontStyle: 'bold', lineSpacing: 4 });
    this.add.text(46, 264, '碰掉坏情绪，把小日子合成喜欢的样子', { fontFamily: FONT_FAMILY, fontSize: '21px', color: '#8b7c64' });
    const stamp = this.add.text(612, 148, '拒绝\n内耗', { fontFamily: FONT_FAMILY, fontSize: '24px', color: '#b26245', align: 'center', backgroundColor: '#fff4da', padding: { x: 16, y: 12 } }).setOrigin(0.5).setAngle(10);
    this.tweens.add({ targets: stamp, angle: 6, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const mochi = this.add.image(545, 606, 'characters', 'ball_1').setDisplaySize(115, 115).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: mochi, y: 598, angle: -4, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    mochi.on('pointerdown', () => {
      this.tweens.add({ targets: mochi, scaleX: mochi.scaleX * 1.12, scaleY: mochi.scaleY * 0.9, duration: 120, yoyo: true });
      const note = this.add.text(470, 507, '摸鱼也是充电', { fontFamily: FONT_FAMILY, fontSize: '22px', color: ink, backgroundColor: '#fff9e7', padding: { x: 12, y: 8 } }).setOrigin(0.5);
      this.tweens.add({ targets: note, y: 480, alpha: 0, delay: 900, duration: 400, onComplete: () => note.destroy() });
    });

    panel(this, 30, 735, 660, 210);
    this.add.text(58, 760, '01  下班闯关', { fontFamily: FONT_FAMILY, fontSize: '32px', color: ink, fontStyle: 'bold' });
    this.add.text(60, 806, '八个工位难题 · 一点巧劲，连锁下班', { fontFamily: FONT_FAMILY, fontSize: '21px', color: '#8b7c64' });
    button(this, 360, 892, 590, '打开打工路线  →', () => this.showRoute(false));
    this.modeCard(30, 976, '02  残影实验室', '轨迹成路，同款共鸣', 4, () => this.showRoute(true));
    this.modeCard(370, 976, '03  我的工位', '收快递，养一屋搭子', 2, () => this.goToWorkstation());
    this.add.text(360, 1230, '慢一点也没关系，总会合出好心情', { fontFamily: FONT_FAMILY, fontSize: '19px', color: '#8b7c64' }).setOrigin(0.5);
    this.cameras.main.fadeIn(350, 244, 239, 223);
  }

  private modeCard(x: number, y: number, title: string, hint: string, level: number, action: () => void) {
    panel(this, x, y, 320, 210, level === 4 ? 0xe8efdf : 0xffedd6);
    const face = this.add.image(x + 270, y + 52, 'characters', `ball_${level}`).setDisplaySize(60, 60);
    this.tweens.add({ targets: face, angle: 7, duration: 1800, yoyo: true, repeat: -1 });
    this.add.text(x + 22, y + 30, title, { fontFamily: FONT_FAMILY, fontSize: '26px', color: ink, fontStyle: 'bold' });
    this.add.text(x + 22, y + 82, hint, { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' });
    button(this, x + 160, y + 158, 268, '进去看看  →', action);
  }

  private showRoute(shadow: boolean) {
    this.tweens.killAll();
    this.children.removeAll(true);
    paper(this);
    this.add.text(42, 48, '← 事务所', { fontFamily: FONT_FAMILY, fontSize: '24px', color: ink }).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.restart({ gameController: this.gameController, gameConfig: this.gameConfig }));
    this.add.text(42, 112, shadow ? '残影实验室' : '一周下班计划', { fontFamily: FONT_FAMILY, fontSize: '48px', color: ink, fontStyle: 'bold' });
    this.add.text(44, 183, '选择关卡练习 · 正式连闯从第一关开始', { fontFamily: FONT_FAMILY, fontSize: '23px', color: '#8b7c64' });
    const levels = shadow ? afterimageLevels : classicLevels;
    const points = levels.map((_, i) => ({ x: i % 2 === 0 ? 174 : 546, y: 315 + i * (shadow ? 200 : 108) }));
    const path = this.add.graphics().lineStyle(12, 0xd6debe, 1);
    for (let i = 1; i < points.length; i++) path.lineBetween(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    for (let i = 0; i < levels.length; i++) {
      const { x, y } = points[i];
      const level = levels[i];
      this.add.circle(x, y + 5, 43, 0xc2b497);
      const node = this.add.circle(x, y, 43, i < 3 ? 0xf6c99e : 0xd4dfbd).setStrokeStyle(3, 0x776b50).setInteractive({ useHandCursor: true });
      this.add.text(x, y, String(i + 1).padStart(2, '0'), { fontFamily: FONT_FAMILY, fontSize: '30px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
      const labelX = i % 2 === 0 ? x + 65 : x - 65;
      const origin = i % 2 === 0 ? 0 : 1;
      this.add.text(labelX, y - 20, level.title, { fontFamily: FONT_FAMILY, fontSize: '25px', color: ink, fontStyle: 'bold' }).setOrigin(origin, 0.5);
      let difficulty = '需要巧劲';
      if (i < 2) difficulty = '轻松热身';
      if (i >= levels.length - 2) difficulty = '烧脑挑战';
      this.add.text(labelX, y + 14, `${level.shots} 发 · ${difficulty}`, { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#8b7c64' }).setOrigin(origin, 0.5);
      node.on('pointerdown', () => this.showStageBrief(shadow, i));
    }
    button(this, 360, 1190, 620, '从第一关开始连闯  →', () => this.startMode(shadow));
    this.cameras.main.fadeIn(250, 244, 239, 223);
  }

  private showStageBrief(shadow: boolean, index: number) {
    const stage = (shadow ? afterimageLevels : classicLevels)[index];
    const start = this.children.length;
    this.add.rectangle(360, 640, 720, 1280, 0x49392d, 0.5).setInteractive();
    panel(this, 65, 230, 590, 825);
    this.add.text(105, 270, `${String(index + 1).padStart(2, '0')} / ${stage.title}`, { fontFamily: FONT_FAMILY, fontSize: '34px', color: ink, fontStyle: 'bold' });
    this.add.text(105, 327, `目标：${characterNames[stage.targetBallLevel ?? 2]} · ${stage.shots}次发射`, { fontFamily: FONT_FAMILY, fontSize: '23px', color: '#6d795a' });
    panel(this, 220, 387, 280, 350, 0xf1ecd9);
    const px = (x: number) => 232 + x * 0.355;
    const py = (y: number) => 390 + (y - 220) * 0.375;
    const obstacles = stage.obstacles ?? [];
    for (let i = 0; i < obstacles.length; i++) {
      const obstacle = obstacles[i];
      if ('radius' in obstacle && obstacle.radius) this.add.circle(px(obstacle.x), py(obstacle.y), obstacle.radius * 0.355, 0xe9be69).setStrokeStyle(1, 0x776b50);
      else this.add.rectangle(px(obstacle.x), py(obstacle.y), (obstacle.width ?? 100) * 0.355, 7, 0x9bab86).setRotation(obstacle.angle ?? 0);
    }
    const presets = stage.presetBalls ?? [];
    for (let i = 0; i < presets.length; i++) {
      const ball = presets[i];
      this.add.image(px(ball.x), py(ball.y), 'characters', `ball_${ball.level}`).setDisplaySize(22 + ball.level * 2, 22 + ball.level * 2);
    }
    this.add.circle(360, 410, 12, 0xee976e);
    this.add.text(360, 782, stage.hint, { fontFamily: FONT_FAMILY, fontSize: '24px', color: ink, wordWrap: { width: 480 }, align: 'center', lineSpacing: 8 }).setOrigin(0.5);
    this.add.text(360, 866, '先看落点，再安排出球顺序', { fontFamily: FONT_FAMILY, fontSize: '21px', color: '#8b7c64' }).setOrigin(0.5);
    button(this, 360, 940, 460, '准备好了，开工  →', () => this.startMode(shadow, index));
    const close = this.add.text(615, 262, '×', { fontFamily: FONT_FAMILY, fontSize: '36px', color: ink }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const contents = this.children.list.slice(start);
    const overlay = this.add.container(0, 0, contents).setDepth(50);
    close.on('pointerdown', () => overlay.destroy(true));
    overlay.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 180 });
  }

  private goToWorkstation() {
    this.scene.start('WorkstationScene', { gameController: this.gameController, gameConfig: this.gameConfig });
  }

  private startMode(afterimageMode: boolean, stage = 0) {
    this.gameController.startRun(afterimageMode ? afterimageLevels : classicLevels);
    for (let i = 0; i < stage; i++) this.gameController.advanceLevel();
    this.scene.start('MainScene', { gameController: this.gameController, gameConfig: this.gameConfig, afterimageMode });
  }
}
