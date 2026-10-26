import Phaser from 'phaser';
import { GameController } from '../core/GameController';
import { Upgrade, GameConfig } from '../types';
import { button, characterNames, ink, panel, paper, FONT_FAMILY } from '../ui/theme';
import { setupHiDpi } from '../ui/hidpi';
import upgradesData from '../config/upgrades.json';

const upgrades = upgradesData as Upgrade[];

export class UpgradeScene extends Phaser.Scene {
  private gameController!: GameController;
  private gameConfig!: GameConfig;
  private selecting = false;

  constructor() {
    super({ key: 'UpgradeScene' });
  }

  init(data: { gameController: GameController; gameConfig: GameConfig }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
    this.selecting = false;
  }

  create() {
    setupHiDpi(this);
    this.input.enabled = true;
    const state = this.gameController.getGameState();
    paper(this);
    this.add.text(360, 100, '情绪释放成功！', { fontFamily: FONT_FAMILY, fontSize: '55px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(360, 166, `第 ${state.currentLevel} 关完成 · 最高 ${this.gameController.getRunSummary().bestCombo} 连合`, { fontFamily: FONT_FAMILY, fontSize: '26px', color: '#8b7c64' }).setOrigin(0.5);
    const target = this.gameController.getLevelConfig().targetBallLevel ?? state.highestBallLevel;
    if (this.textures.exists('characters')) this.add.image(360, 266, 'characters', `ball_${target}`).setDisplaySize(118, 118);
    this.add.text(360, 360, '打工辛苦了，领一份小福利', { fontFamily: FONT_FAMILY, fontSize: '28px', color: ink }).setOrigin(0.5);
    const selected = this.selectRandomUpgrades(3);
    for (let i = 0, length = selected.length; i < length; i++) this.createUpgradeButton(selected[i], i);
    this.add.text(360, 1170, `刚刚解锁：${characterNames[target]}  ·  升级持续整局`, { fontFamily: FONT_FAMILY, fontSize: '22px', color: '#8b7c64' }).setOrigin(0.5);
  }

  private selectRandomUpgrades(count: number): Upgrade[] {
    const state = this.gameController.getGameState();
    const available = upgrades.filter(upgrade => {
      // 手工关卡依赖固定球径和发射等级，只提供不改变谜题结构的福利。
      if (this.gameController.getLevelConfig().shotSequence && ['bigger_balls', 'starting_level_boost'].includes(upgrade.id)) return false;
      if (upgrade.id === 'bigger_balls') return state.ballSizeMultiplier < 1.6;
      return upgrade.id !== 'starting_level_boost' || state.startingBallLevel < 3;
    });
    const selected: Upgrade[] = [];
    for (let i = 0; i < count && available.length > 0; i++) {
      const index = Math.floor(Math.random() * available.length);
      selected.push(available.splice(index, 1)[0]);
    }
    return selected;
  }

  private createUpgradeButton(upgrade: Upgrade, index: number) {
    const y = 430 + index * 220;
    panel(this, 60, y, 600, 190);
    this.add.text(92, y + 26, upgrade.name, { fontFamily: FONT_FAMILY, fontSize: '30px', color: ink, fontStyle: 'bold' });
    this.add.text(92, y + 73, upgrade.description, { fontFamily: FONT_FAMILY, fontSize: '23px', color: '#8b7c64' });
    button(this, 360, y + 145, 220, '领取福利', () => this.selectUpgrade(upgrade));
  }

  private selectUpgrade(upgrade: Upgrade) {
    if (this.selecting) return;
    this.selecting = true;
    this.input.enabled = false;
    this.gameController.applyUpgrade(upgrade);
    this.gameController.advanceLevel();
    this.cameras.main.fadeOut(220, 244, 239, 223);
    this.time.delayedCall(220, () => {
      this.scene.start('MainScene', { gameController: this.gameController, gameConfig: this.gameConfig });
    });
  }
}
