import Phaser from 'phaser';
import { GameController } from '../core/GameController';
import { GameConfig } from '../types';
import { getPlatform } from '../platform';
import { button, characterNames, ink, panel, paper, FONT_FAMILY } from '../ui/theme';
import { loadOfficeArt } from '../ui/officeArt';
import { paperConfetti } from '../ui/officeEffects';
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

  preload() { loadOfficeArt(this); }

  create() {
    setupHiDpi(this);
    const state = this.gameController.getGameState();
    const summary = this.gameController.getRunSummary();
    paper(this);
    this.add.image(360, 640, 'office-room').setDisplaySize(850, 1280).setAlpha(0.18);
    this.add.text(40, 40, '下班事务所 / 今日回执', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' });
    this.add.text(360, 112, this.won ? '全员下班，收工！' : '今天，也很努力了', { fontFamily: FONT_FAMILY, fontSize: '43px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
    const mode = this.afterimageMode ? '残影挑战' : '打工日常';
    this.add.text(360, 180, `${mode} · 第 ${state.currentLevel} 关`, { fontFamily: FONT_FAMILY, fontSize: '25px', color: '#8b7c64' }).setOrigin(0.5);

    const start = this.children.length;
    panel(this, 50, 230, 620, 700);
    this.add.circle(360, 355, 102, 0xf1e5cd, 0.7);
    const highest = Math.max(1, summary.highest);
    const hero = this.add.image(360, 350, 'characters', `ball_${highest}`).setDisplaySize(165, 165);
    const stamp = this.add.text(546, 365, this.won ? '准点\n下班' : '稍作\n休息', { fontFamily: FONT_FAMILY, fontSize: '27px', color: '#a15c40', align: 'center', backgroundColor: '#fff0d8', padding: { x: 12, y: 9 } }).setOrigin(0.5).setAngle(10);
    this.add.text(360, 475, '今日快乐值', { fontFamily: FONT_FAMILY, fontSize: '23px', color: '#8b7c64' }).setOrigin(0.5);
    const score = this.add.text(360, 540, '0', { fontFamily: FONT_FAMILY, fontSize: '72px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
    const record = this.add.text(360, 608, '', { fontFamily: FONT_FAMILY, fontSize: '22px', color: '#8b7c64' }).setOrigin(0.5);
    const rule = this.add.graphics().lineStyle(2, 0xd9c8a5);
    for (let x = 80; x < 640; x += 24) rule.lineBetween(x, 656, x + 12, 656);
    const values = [String(summary.merges), String(summary.bestCombo), characterNames[highest]];
    const labels = ['合成次数', '最高连合', '最佳搭子'];
    for (let i = 0; i < 3; i++) {
      const x = 156 + i * 204;
      this.add.text(x, 716, values[i], { fontFamily: FONT_FAMILY, fontSize: '29px', color: '#547044', fontStyle: 'bold' }).setOrigin(0.5);
      this.add.text(x, 761, labels[i], { fontFamily: FONT_FAMILY, fontSize: '21px', color: '#8b7c64' }).setOrigin(0.5);
    }
    const stage = this.gameController.getLevelConfig();
    const advice = this.won ? '把好心情带回工位，搭子还在等你' : `再试一次：${stage.hint ?? '先看落点，再安排出球顺序'}`;
    this.add.text(360, 847, advice, { fontFamily: FONT_FAMILY, fontSize: '23px', color: ink, align: 'center', wordWrap: { width: 510 }, lineSpacing: 10 }).setOrigin(0.5);
    const report = this.add.container(0, 20, this.children.list.slice(start)).setAlpha(0);
    this.tweens.add({ targets: report, y: 0, alpha: 1, duration: 400, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: hero, y: hero.y - 7, angle: 3, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    stamp.setScale(1.8).setAlpha(0);
    this.tweens.add({ targets: stamp, scaleX: 1, scaleY: 1, alpha: 1, delay: 350, duration: 200, ease: 'Cubic.easeIn' });
    const counter = { value: 0 };
    this.tweens.add({ targets: counter, value: state.score, duration: 700, ease: 'Cubic.easeOut', onUpdate: () => score.setText(String(Math.floor(counter.value))), onComplete: () => score.setText(String(state.score)) });
    if (this.won) {
      const celebration = this.add.container(0, 0).setDepth(20);
      paperConfetti(this, celebration);
    }

    button(this, 360, 1010, 590, this.won ? '去工位，看看搭子' : `再试第 ${state.currentLevel} 关`, () => {
      if (this.restarting) return;
      this.restarting = true;
      if (this.won) {
        this.scene.start('WorkstationScene', { gameController: this.gameController, gameConfig: this.gameConfig });
        return;
      }
      this.gameController.retryLevel();
      this.scene.start('MainScene', { gameController: this.gameController, gameConfig: this.gameConfig, afterimageMode: this.afterimageMode });
    });
    button(this, 205, 1120, 280, this.won ? '再挑战一次' : '去我的工位', () => {
      if (this.won) { this.restart(); return; }
      if (this.restarting) return;
      this.restarting = true;
      this.scene.start('WorkstationScene', { gameController: this.gameController, gameConfig: this.gameConfig });
    });
    button(this, 515, 1120, 280, '返回首页', () => {
      if (this.restarting) return;
      this.restarting = true;
      this.scene.start('HomeScene', { gameController: this.gameController, gameConfig: this.gameConfig });
    });
    this.add.text(360, 1230, this.won ? '今天的快乐，已签收' : '不用急，下班的路有很多条', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' }).setOrigin(0.5);
    this.saveRecord(record);
  }

  private async saveRecord(label: Phaser.GameObjects.Text) {
    const platform = getPlatform();
    const state = this.gameController.getGameState();
    const recordKey = this.afterimageMode ? 'afterimage_best_score' : 'best_score';
    const stored = Number(await platform.loadData(recordKey));
    const previous = Number.isFinite(stored) ? Math.max(0, stored) : 0;
    const best = Math.max(previous, state.score);
    await platform.saveData(recordKey, String(best));
    if (label.active) label.setText(state.score > previous ? `新纪录！个人最佳 ${best}` : `个人最佳 ${best}`);
  }

  private restart() {
    if (this.restarting) return;
    this.restarting = true;
    this.gameController.reset();
    this.scene.start('MainScene', { gameController: this.gameController, gameConfig: this.gameConfig, afterimageMode: this.afterimageMode });
  }
}
