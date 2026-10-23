import Phaser from 'phaser';
import { GameController } from '../core/GameController';
import { Upgrade, GameConfig } from '../types';
import { button, fruitNames, ink, panel } from '../ui/theme';
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
    this.input.enabled = true;
    const state = this.gameController.getGameState();
    this.add.rectangle(0, 0, 720, 1280, 0xf7e6ef).setOrigin(0);
    this.add.text(360, 100, '合得漂亮！', { fontSize: '55px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(360, 166, `第 ${state.currentLevel} 关完成 · 得分 ${state.score}`, { fontSize: '26px', color: '#986b91' }).setOrigin(0.5);
    const target = this.gameController.getLevelConfig().targetBallLevel ?? state.highestBallLevel;
    if (this.textures.exists(`ball_${target}`)) this.add.image(360, 266, `ball_${target}`).setDisplaySize(118, 118);
    this.add.text(360, 360, '选一个升级，让下一局更爽', { fontSize: '28px', color: ink }).setOrigin(0.5);
    const selected = this.selectRandomUpgrades(3);
    for (let i = 0, length = selected.length; i < length; i++) this.createUpgradeButton(selected[i], i);
    this.add.text(360, 1170, `刚刚解锁：${fruitNames[target]}  ·  升级持续整局`, { fontSize: '22px', color: '#986b91' }).setOrigin(0.5);
  }

  private selectRandomUpgrades(count: number): Upgrade[] {
    const state = this.gameController.getGameState();
    const available = upgrades.filter(upgrade => {
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
    this.add.text(92, y + 26, upgrade.name, { fontSize: '30px', color: ink, fontStyle: 'bold' });
    this.add.text(92, y + 73, upgrade.description, { fontSize: '23px', color: '#986b91' });
    button(this, 360, y + 145, 220, '就选这个', () => this.selectUpgrade(upgrade));
  }

  private selectUpgrade(upgrade: Upgrade) {
    if (this.selecting) return;
    this.selecting = true;
    this.input.enabled = false;
    this.gameController.applyUpgrade(upgrade);
    this.gameController.advanceLevel();
    this.cameras.main.fadeOut(220, 247, 230, 239);
    this.time.delayedCall(220, () => {
      this.scene.start('MainScene', { gameController: this.gameController, gameConfig: this.gameConfig });
    });
  }
}
