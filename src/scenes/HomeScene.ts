import Phaser from 'phaser';
import { GameController } from '../core/GameController';
import { GameConfig } from '../types';
import { button, ink, panel, paper, FONT_FAMILY } from '../ui/theme';
import { setupHiDpi } from '../ui/hidpi';

export class HomeScene extends Phaser.Scene {
  private gameController!: GameController;
  private gameConfig!: GameConfig;

  constructor() {
    super({ key: 'HomeScene' });
  }

  init(data: { gameController: GameController; gameConfig: GameConfig }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
  }

  create() {
    setupHiDpi(this);
    
    paper(this);
    
    // Title
    this.add.text(360, 200, '弹弹合', {
      fontFamily: FONT_FAMILY,
      fontSize: '72px',
      color: ink,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    this.add.text(360, 280, '下班团子 · 碰掉坏情绪', {
      fontFamily: FONT_FAMILY,
      fontSize: '28px',
      color: '#8b7c64'
    }).setOrigin(0.5);

    // Mode selection
    panel(this, 80, 420, 560, 180);
    this.add.text(360, 470, '经典模式', {
      fontFamily: FONT_FAMILY,
      fontSize: '36px',
      color: ink,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(360, 520, '同款相碰升级 · 用完发射前达成目标', {
      fontFamily: FONT_FAMILY,
      fontSize: '22px',
      color: '#8b7c64'
    }).setOrigin(0.5);
    button(this, 360, 565, 400, '开始游戏', () => this.startMode(false));

    panel(this, 80, 660, 560, 180);
    this.add.text(360, 710, '残影弹珠', {
      fontFamily: FONT_FAMILY,
      fontSize: '36px',
      color: ink,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(360, 760, '轨迹变实体 · 同型残影磁吸合并', {
      fontFamily: FONT_FAMILY,
      fontSize: '22px',
      color: '#8b7c64'
    }).setOrigin(0.5);
    button(this, 360, 805, 400, '开始残影模式', () => this.startMode(true));

    this.add.text(360, 1200, '选择游戏模式', {
      fontFamily: FONT_FAMILY,
      fontSize: '24px',
      color: '#a69a82'
    }).setOrigin(0.5);
  }

  private startMode(afterimageMode: boolean) {
    this.gameController.reset();
    this.scene.start('MainScene', {
      gameController: this.gameController,
      gameConfig: this.gameConfig,
      afterimageMode
    });
  }
}
