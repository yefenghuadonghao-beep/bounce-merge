import Phaser from 'phaser';
import { GameController } from '../core/GameController';
import { GameConfig } from '../types';

export class GameOverScene extends Phaser.Scene {
  private gameController!: GameController;
  private gameConfig!: GameConfig;
  private won!: boolean;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: { gameController: GameController; gameConfig: GameConfig; won: boolean }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
    this.won = data.won;
  }

  create() {
    const state = this.gameController.getGameState();
    
    this.add.rectangle(0, 0, this.gameConfig.width, this.gameConfig.height, 0x0f1419).setOrigin(0);

    const titleText = this.won ? '胜利!' : '游戏结束';
    const titleColor = this.won ? '#1dd1a1' : '#ee5a6f';

    this.add.text(this.gameConfig.width / 2, 200, titleText, {
      fontSize: '64px',
      color: titleColor,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(this.gameConfig.width / 2, 320, `最终得分: ${state.score}`, {
      fontSize: '36px',
      color: '#feca57'
    }).setOrigin(0.5);

    this.add.text(this.gameConfig.width / 2, 400, `到达关卡: ${state.currentLevel}`, {
      fontSize: '28px',
      color: '#ffffff'
    }).setOrigin(0.5);

    if (state.upgrades.length > 0) {
      this.add.text(this.gameConfig.width / 2, 500, '已获得的升级:', {
        fontSize: '24px',
        color: '#48dbfb'
      }).setOrigin(0.5);

      state.upgrades.forEach((upgrade, index) => {
        this.add.text(this.gameConfig.width / 2, 550 + index * 35, `• ${upgrade.name}`, {
          fontSize: '20px',
          color: '#dfe6e9'
        }).setOrigin(0.5);
      });
    }

    this.createRestartButton();
  }

  private createRestartButton() {
    const button = this.add.container(this.gameConfig.width / 2, this.gameConfig.height - 200);

    const bg = this.add.rectangle(0, 0, 300, 80, 0x48dbfb, 0.9);
    bg.setStrokeStyle(4, 0xffffff);
    
    const text = this.add.text(0, 0, '重新开始', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    button.add([bg, text]);
    button.setSize(300, 80);
    button.setInteractive();

    button.on('pointerover', () => {
      bg.setFillStyle(0x5a8fbf);
      this.tweens.add({
        targets: button,
        scale: 1.05,
        duration: 100
      });
    });

    button.on('pointerout', () => {
      bg.setFillStyle(0x48dbfb);
      this.tweens.add({
        targets: button,
        scale: 1,
        duration: 100
      });
    });

    button.on('pointerdown', () => {
      this.restart();
    });
  }

  private restart() {
    this.gameController.reset();
    
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.start('MainScene', { gameController: this.gameController, gameConfig: this.gameConfig });
    });
  }
}
