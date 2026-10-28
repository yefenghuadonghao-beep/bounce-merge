import Phaser from 'phaser';
import { GameController } from '../core/GameController';
import { Upgrade, GameConfig, LevelConfig } from '../types';
import { battlePlans } from '../core/BattlePlan';
import { button, characterNames, ink, panel, paper, FONT_FAMILY } from '../ui/theme';
import { battleCardCopy } from '../ui/battleCardCopy';
import { setupHiDpi } from '../ui/hidpi';
import { assetUrl } from '../platform/assets';
import { getPlatform } from '../platform';
import { loadOfficeArt } from '../ui/officeArt';
import { boardPreview } from '../ui/boardPreview';

export class UpgradeScene extends Phaser.Scene {
  private gameController!: GameController;
  private gameConfig!: GameConfig;
  private afterimageMode = false;
  private selecting = false;
  private feedback?: Phaser.GameObjects.Text;
  private mapOverlay?: Phaser.GameObjects.Container;
  private cardViews = new Map<string, { root: Phaser.GameObjects.Container; art: Phaser.GameObjects.Image; stamp: Phaser.GameObjects.Text }>();

  constructor() { super({ key: 'UpgradeScene' }); }

  init(data: { gameController: GameController; gameConfig: GameConfig; afterimageMode?: boolean }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
    this.afterimageMode = data.afterimageMode ?? false;
    this.selecting = false;
    this.feedback = undefined;
    this.mapOverlay = undefined;
    this.cardViews.clear();
  }

  preload() {
    loadOfficeArt(this);
    const names = ['supply', 'control', 'chain'];
    for (let i = 0; i < names.length; i++) {
      const key = `card-${names[i]}`;
      if (!this.textures.exists(key)) this.load.image(key, assetUrl(`assets/office/card-${names[i]}.webp`));
    }
  }

  create() {
    setupHiDpi(this);
    this.input.enabled = true;
    paper(this);
    const next = this.gameController.getNextLevelConfig();
    this.add.image(360, 640, 'office-room').setDisplaySize(850, 1280).setAlpha(0.14);
    this.add.text(40, 36, '下班事务所 / 战术补给', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' });
    this.add.text(40, 77, '下一关，带哪个搭子？', { fontFamily: FONT_FAMILY, fontSize: '39px', color: ink, fontStyle: 'bold' });


    panel(this, 36, 145, 648, 182);
    this.add.text(60, 162, `下一关 ${next.level} · ${next.title}`, { fontFamily: FONT_FAMILY, fontSize: '26px', color: ink, fontStyle: 'bold' });
    const target = characterNames[next.targetBallLevel ?? 3];
    const resonance = next.requiredAfterimageMerges ? ` · 共鸣 ${next.requiredAfterimageMerges} 次` : '';
    this.add.text(60, 206, `目标：${target}${resonance}`, { fontFamily: FONT_FAMILY, fontSize: '22px', color: ink });
    this.add.text(60, 250, next.hint ?? '先看预摆搭子，再安排出球', { fontFamily: FONT_FAMILY, fontSize: '22px', color: '#6d795a', wordWrap: { width: 422 }, lineSpacing: 6 });
    boardPreview(this, next, 511, 159, 150, 128);
    this.add.text(586, 303, '看布局 ↗', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b6041' }).setOrigin(0.5);
    this.add.rectangle(586, 235, 156, 170, 0xffffff, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.showMap(next));

    const plans = battlePlans();
    for (let i = 0; i < plans.length; i++) this.createUpgradeButton(plans[i], i, next);
    this.feedback = this.add.text(360, 1116, '三选一 · 仅下一关生效 · 重试保留', { fontFamily: FONT_FAMILY, fontSize: '21px', color: '#8b6041' }).setOrigin(0.5);
    button(this, 205, 1212, 280, '返回首页', () => {
      if (this.selecting) return;
      this.selecting = true;
      this.scene.start('HomeScene', { gameController: this.gameController, gameConfig: this.gameConfig });
    });
    button(this, 515, 1212, 280, '去工位拆快递', () => {
      if (this.selecting || this.mapOverlay) return;
      this.selecting = true;
      this.scene.start('WorkstationScene', { gameController: this.gameController, gameConfig: this.gameConfig, afterimageMode: this.afterimageMode, returnTo: 'UpgradeScene' });
    });
  }

  private showMap(level: LevelConfig) {
    if (this.selecting || this.mapOverlay) return;
    const start = this.children.length;
    const shade = this.add.rectangle(360, 640, 720, 1280, 0x49392d, 0.62).setInteractive();
    shade.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    panel(this, 45, 100, 630, 1080);
    this.add.text(80, 132, `第 ${level.level} 关 · ${level.title}`, { fontFamily: FONT_FAMILY, fontSize: '32px', color: ink, fontStyle: 'bold' });
    this.add.text(80, 188, '看清机关和搭子，再选战术', { fontFamily: FONT_FAMILY, fontSize: '23px', color: '#8b7c64' });
    boardPreview(this, level, 140, 240, 440, 550);
    this.add.text(80, 827, '前六球 · 从左往右发射', { fontFamily: FONT_FAMILY, fontSize: '22px', color: ink });
    const queue = level.shotSequence ?? [];
    for (let i = 0; i < Math.min(6, queue.length); i++) {
      this.add.image(120 + i * 96, 893, 'characters', `ball_${queue[i]}`).setDisplaySize(52, 52);
      this.add.text(120 + i * 96, 934, String(i + 1), { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#8b7c64' }).setOrigin(0.5);
    }
    this.add.text(360, 1000, level.hint ?? '同款相碰，合出目标搭子', { fontFamily: FONT_FAMILY, fontSize: '23px', color: '#547044', wordWrap: { width: 530 }, align: 'center' }).setOrigin(0.5);
    button(this, 360, 1110, 520, '看好了，返回选卡', () => {
      this.mapOverlay?.destroy(true);
      this.mapOverlay = undefined;
    });
    this.mapOverlay = this.add.container(0, 0, this.children.list.slice(start)).setDepth(50);
  }

  private createUpgradeButton(upgrade: Upgrade, index: number, next: LevelConfig) {
    const y = 350 + index * 246;
    const start = this.children.length;
    const colors = [0xffedd6, 0xe7eeee, 0xeaf0df];
    const tags = ['多留一手', '掌握顺序', '抱团破局'];
    const names = ['supply', 'control', 'chain'];
    const copy = battleCardCopy(upgrade, next);
    panel(this, 36, y, 648, 236, colors[index]);
    this.add.circle(136, y + 100, 80, 0xfffcf2, 0.7);
    const art = this.add.image(136, y + 103, `card-${names[index]}`).setDisplaySize(168, 168);
    if (index === 0) {
      const extra = this.add.image(202, y + 51, 'characters', 'ball_2').setDisplaySize(25, 25);
      this.tweens.add({ targets: extra, y: extra.y - 16, angle: 10, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (index === 1) {
      const first = this.add.image(91, y + 176, 'characters', 'ball_1').setDisplaySize(24, 24);
      const second = this.add.image(181, y + 176, 'characters', 'ball_3').setDisplaySize(24, 24);
      this.tweens.add({ targets: first, x: 181, duration: 1100, yoyo: true, repeat: -1, hold: 400, repeatDelay: 400, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: second, x: 91, duration: 1100, yoyo: true, repeat: -1, hold: 400, repeatDelay: 400, ease: 'Sine.easeInOut' });
    } else {
      const pulse = this.add.circle(136, y + 103, 70, 0xa8bc8d, 0).setStrokeStyle(2, 0x9cad82, 0.6);
      this.tweens.add({ targets: pulse, radius: 87, alpha: 0, duration: 1400, repeat: -1, repeatDelay: 300 });
    }
    this.add.text(244, y + 17, upgrade.name, { fontFamily: FONT_FAMILY, fontSize: '31px', color: ink, fontStyle: 'bold' });
    this.add.text(648, y + 24, tags[index], { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#8b6041' }).setOrigin(1, 0);
    this.add.text(244, y + 64, copy.benefit, { fontFamily: FONT_FAMILY, fontSize: '24px', color: '#547044', fontStyle: 'bold' });
    this.add.text(244, y + 102, copy.useCase, { fontFamily: FONT_FAMILY, fontSize: '22px', color: ink });
    for (let i = 0; i < copy.resources.length; i++) {
      const resource = copy.resources[i];
      let color = '#8b7c64';
      if (resource.after > resource.before) color = '#547044';
      if (resource.after < resource.before) color = '#a15c40';
      const value = resource.before === resource.after ? String(resource.after) : `${resource.before}→${resource.after}`;
      this.add.text(244 + i * 139, y + 132, `${resource.label} ${value}`, { fontFamily: FONT_FAMILY, fontSize: '20px', color, fontStyle: 'bold' });
    }
    this.add.text(60, y + 199, copy.cost, { fontFamily: FONT_FAMILY, fontSize: '19px', color: '#965c43' });
    const pick = button(this, 585, y + 197, 145, '带上它', () => this.selectUpgrade(upgrade));
    const stamp = this.add.text(155, y + 138, '已装备', { fontFamily: FONT_FAMILY, fontSize: '24px', color: '#a15c40', backgroundColor: '#fff3db', padding: { x: 10, y: 6 } }).setOrigin(0.5).setAngle(-12).setAlpha(0);
    const root = this.add.container(0, 0, this.children.list.slice(start));
    this.cardViews.set(upgrade.id, { root, art, stamp });
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 260, delay: index * 80 });
    this.tweens.add({ targets: art, y: art.y - 5, angle: index === 1 ? -3 : 3, duration: 1400 + index * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    pick.container.on('pointerover', () => this.tweens.add({ targets: art, displayWidth: 177, displayHeight: 177, duration: 140 }));
    pick.container.on('pointerout', () => this.tweens.add({ targets: art, displayWidth: 168, displayHeight: 168, duration: 140 }));
  }

  private selectUpgrade(upgrade: Upgrade) {
    if (this.selecting || this.mapOverlay) return;
    this.selecting = true;
    this.input.enabled = false;
    this.cardViews.forEach((view, id) => {
      this.tweens.killTweensOf(view.art);
      if (id === upgrade.id) {
        view.stamp.setScale(1.8);
        this.tweens.add({ targets: view.stamp, scaleX: 1, scaleY: 1, alpha: 1, duration: 230, ease: 'Cubic.easeIn' });
        this.tweens.add({ targets: view.art, y: view.art.y - 12, duration: 230, yoyo: true, ease: 'Sine.easeInOut' });
      } else {
        this.tweens.add({ targets: view.root, alpha: 0.35, duration: 200 });
      }
    });
    this.feedback?.setText(`已装备「${upgrade.name}」· 下一关出发！`);
    getPlatform().playSound('swap');
    this.gameController.applyUpgrade(upgrade);
    this.gameController.advanceLevel();
    this.time.delayedCall(500, () => {
      this.scene.start('MainScene', { gameController: this.gameController, gameConfig: this.gameConfig, afterimageMode: this.afterimageMode });
    });
  }
}
