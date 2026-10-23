import Phaser from 'phaser';
import { GameController } from '../core/GameController';
import { Upgrade, GameConfig } from '../types';
import upgradesData from '../config/upgrades.json';

const upgrades = upgradesData as Upgrade[];

export class UpgradeScene extends Phaser.Scene {
  private gameController!: GameController;
  private gameConfig!: GameConfig;
  private selectedUpgrades: Upgrade[] = [];

  constructor() {
    super({ key: 'UpgradeScene' });
  }

  init(data: { gameController: GameController; gameConfig: GameConfig }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
  }

  create() {
    const state = this.gameController.getGameState();
    
    this.add.rectangle(0, 0, this.gameConfig.width, this.gameConfig.height, 0x0f1419).setOrigin(0);

    this.add.text(this.gameConfig.width / 2, 100, `关卡 ${state.currentLevel} 完成!`, {
      fontSize: '48px',
      color: '#feca57',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(this.gameConfig.width / 2, 180, `得分: ${state.score}`, {
      fontSize: '32px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.add.text(this.gameConfig.width / 2, 280, '选择一个升级:', {
      fontSize: '28px',
      color: '#48dbfb'
    }).setOrigin(0.5);

    this.selectedUpgrades = this.selectRandomUpgrades(3);
    
    this.selectedUpgrades.forEach((upgrade, index) => {
      this.createUpgradeButton(upgrade, index);
    });
  }

  private selectRandomUpgrades(count: number): Upgrade[] {
    const available = [...upgrades];
    const selected: Upgrade[] = [];
    
    for (let i = 0; i < count && available.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * available.length);
      selected.push(available[randomIndex]);
      available.splice(randomIndex, 1);
    }
    
    return selected;
  }

  private createUpgradeButton(upgrade: Upgrade, index: number) {
    const y = 400 + index * 200;
    const x = this.gameConfig.width / 2;

    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, 600, 160, 0x2c3e50, 0.9);
    bg.setStrokeStyle(4, 0x48dbfb);
    
    const title = this.add.text(0, -40, upgrade.name, {
      fontSize: '28px',
      color: '#feca57',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const desc = this.add.text(0, 10, upgrade.description, {
      fontSize: '22px',
      color: '#dfe6e9'
    }).setOrigin(0.5);

    container.add([bg, title, desc]);
    container.setSize(600, 160);
    container.setInteractive();

    container.on('pointerover', () => {
      bg.setFillStyle(0x34495e);
      this.tweens.add({
        targets: container,
        scale: 1.05,
        duration: 100
      });
    });

    container.on('pointerout', () => {
      bg.setFillStyle(0x2c3e50);
      this.tweens.add({
        targets: container,
        scale: 1,
        duration: 100
      });
    });

    container.on('pointerdown', () => {
      this.selectUpgrade(upgrade);
    });
  }

  private selectUpgrade(upgrade: Upgrade) {
    this.gameController.applyUpgrade(upgrade);
    this.gameController.advanceLevel();
    
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.start('MainScene', { gameController: this.gameController, gameConfig: this.gameConfig });
    });
  }
}
