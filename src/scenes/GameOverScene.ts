import Phaser from 'phaser';
import { GameController } from '../core/GameController';
import { GameConfig } from '../types';
import { getPlatform } from '../platform';
import { button, characterNames, ink, panel, paper, FONT_FAMILY } from '../ui/theme';
import { setupHiDpi } from '../ui/hidpi';

export class GameOverScene extends Phaser.Scene {
  private gameController!: GameController;
  private gameConfig!: GameConfig;
  private afterimageMode: boolean = false;
  private restarting = false;
  private won = false;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: { gameController: GameController; gameConfig: GameConfig; won?: boolean; afterimageMode?: boolean }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
    this.afterimageMode = data.afterimageMode ?? false;
    this.restarting = false;
    this.won = data.won ?? false;
  }

  create() {
    setupHiDpi(this);
    const state = this.gameController.getGameState();
    const summary = this.gameController.getRunSummary();
    paper(this);
    this.add.text(360, 160, this.won ? '第一章，全员下班！' : '今天也辛苦啦', { fontFamily: FONT_FAMILY, fontSize: '43px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(360, 225, `情绪释放到第 ${state.currentLevel} 关`, { fontFamily: FONT_FAMILY, fontSize: '27px', color: '#8b7c64' }).setOrigin(0.5);
    panel(this, 70, 305, 580, 400);
    this.add.text(360, 355, '今日快乐值', { fontFamily: FONT_FAMILY, fontSize: '24px', color: '#8b7c64' }).setOrigin(0.5);
    this.add.text(360, 430, String(state.score), { fontFamily: FONT_FAMILY, fontSize: '74px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
    const record = this.add.text(360, 510, '', { fontFamily: FONT_FAMILY, fontSize: '23px', color: '#8b7c64' }).setOrigin(0.5);
    this.add.text(360, 585, `本轮最高：${characterNames[summary.highest]}`, { fontFamily: FONT_FAMILY, fontSize: '27px', color: ink }).setOrigin(0.5);
    this.add.text(360, 760, `最高 ${summary.bestCombo} 连合 · 碰掉 ${summary.merges} 次坏情绪\n下一次，试试让连合不断档！`, {
      fontFamily: FONT_FAMILY, fontSize: '24px', color: '#8b7c64', align: 'center', lineSpacing: 14
    }).setOrigin(0.5);
    if (this.textures.exists('characters')) this.add.image(360, 1110, 'characters', `ball_${summary.highest}`).setDisplaySize(135, 135);
    button(this, 360, 930, 440, this.won ? '再挑战第一章' : '重试本关', () => {
      if (this.won) { this.restart(); return; }
      if (this.restarting) return;
      this.restarting = true;
      this.gameController.retryLevel();
      this.scene.start('MainScene', { gameController: this.gameController, gameConfig: this.gameConfig, afterimageMode: this.afterimageMode });
    });
    this.saveRecord(record);
  }

  private async saveRecord(label: Phaser.GameObjects.Text) {
    const platform = getPlatform();
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
    this.scene.start('MainScene', { gameController: this.gameController, gameConfig: this.gameConfig, afterimageMode: this.afterimageMode });
  }
}
