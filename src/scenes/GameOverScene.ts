import Phaser from 'phaser';
import { GameController } from '../core/GameController';
import { GameConfig } from '../types';
import { WebPlatform } from '../platform/WebPlatform';
import { button, fruitNames, ink, panel } from '../ui/theme';

export class GameOverScene extends Phaser.Scene {
  private gameController!: GameController;
  private gameConfig!: GameConfig;
  private restarting = false;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: { gameController: GameController; gameConfig: GameConfig }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
    this.restarting = false;
  }

  create() {
    const state = this.gameController.getGameState();
    this.add.rectangle(0, 0, 720, 1280, 0xf7e6ef).setOrigin(0);
    this.add.text(360, 160, '再来一次，就差一点', { fontSize: '43px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(360, 225, `这次到达第 ${state.currentLevel} 关`, { fontSize: '27px', color: '#986b91' }).setOrigin(0.5);
    panel(this, 70, 305, 580, 400);
    this.add.text(360, 355, '本次得分', { fontSize: '24px', color: '#986b91' }).setOrigin(0.5);
    this.add.text(360, 430, String(state.score), { fontSize: '74px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
    const record = this.add.text(360, 510, '', { fontSize: '23px', color: '#986b91' }).setOrigin(0.5);
    this.add.text(360, 585, `本关合出：${fruitNames[state.highestBallLevel]}`, { fontSize: '27px', color: ink }).setOrigin(0.5);
    this.add.text(360, 760, '小技巧：看好下一球，连续追击同类水果\n球分散时，留一次「聚拢一下」救场', {
      fontSize: '24px', color: '#986b91', align: 'center', lineSpacing: 14
    }).setOrigin(0.5);
    button(this, 360, 930, 440, '再玩一局', () => this.restart());
    this.saveRecord(record);
  }

  private async saveRecord(label: Phaser.GameObjects.Text) {
    const platform = new WebPlatform();
    const state = this.gameController.getGameState();
    const stored = Number(await platform.loadData('best_score'));
    const previous = Number.isFinite(stored) ? Math.max(0, stored) : 0;
    const best = Math.max(previous, state.score);
    await platform.saveData('best_score', String(best));
    if (label.active) label.setText(state.score > previous ? `新纪录！个人最佳 ${best}` : `个人最佳 ${best}`);
  }

  private restart() {
    if (this.restarting) return;
    this.restarting = true;
    this.gameController.reset();
    this.scene.start('MainScene', { gameController: this.gameController, gameConfig: this.gameConfig });
  }
}
