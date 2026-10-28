import Phaser from 'phaser';
import { GameController } from '../core/GameController';
import { GameConfig } from '../types';
import type { StageReward } from '../core/JourneyProgress';
import { getPlatform } from '../platform';
import { button, ink, panel, paper, FONT_FAMILY } from '../ui/theme';
import { resultCopy } from '../ui/resultCopy';
import { loadOfficeArt } from '../ui/officeArt';
import { paperConfetti } from '../ui/officeEffects';
import { setupHiDpi } from '../ui/hidpi';

export class GameOverScene extends Phaser.Scene {
  private gameController!: GameController;
  private gameConfig!: GameConfig;
  private afterimageMode: boolean = false;
  private restarting = false;
  private won = false;
  private afterimageMerges?: number;
  private reward?: StageReward;

  constructor() {
    super({ key: 'GameOverScene' });
  }

  init(data: { gameController: GameController; gameConfig: GameConfig; won?: boolean; afterimageMode?: boolean; afterimageMerges?: number; reward?: StageReward }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
    this.afterimageMode = data.afterimageMode ?? false;
    this.restarting = false;
    this.won = data.won ?? false;
    this.afterimageMerges = data.afterimageMerges;
    this.reward = data.reward;
  }

  preload() { loadOfficeArt(this); }

  create() {
    setupHiDpi(this);
    const state = this.gameController.getGameState();
    const summary = this.gameController.getRunSummary();
    const stage = this.gameController.getLevelConfig();
    const levelSummary = this.gameController.getLevelSummary();
    const copy = resultCopy(stage, state, this.won, this.afterimageMerges);
    paper(this);
    this.add.image(360, 640, 'office-room').setDisplaySize(850, 1280).setAlpha(0.18);
    this.add.text(40, 40, '下班事务所 / 今日回执', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' });
    this.add.text(360, 112, copy.headline, { fontFamily: FONT_FAMILY, fontSize: '41px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
    const mode = this.afterimageMode ? '残影挑战' : '打工日常';
    this.add.text(360, 180, `${mode} · 第 ${state.currentLevel} 关 ${stage.title ?? ''}`, { fontFamily: FONT_FAMILY, fontSize: '24px', color: '#8b7c64' }).setOrigin(0.5);

    const start = this.children.length;
    panel(this, 50, 230, 620, 720);
    this.add.text(220, 272, '本关合出', { fontFamily: FONT_FAMILY, fontSize: '21px', color: '#8b7c64' }).setOrigin(0.5);
    this.add.text(500, 272, '过关目标', { fontFamily: FONT_FAMILY, fontSize: '21px', color: '#8b7c64' }).setOrigin(0.5);
    this.add.circle(220, 355, 76, 0xf1e5cd, 0.7);
    this.add.circle(500, 355, 76, 0xe5ecd7, 0.7);
    const hero = this.add.image(220, 350, 'characters', `ball_${copy.actualLevel}`).setDisplaySize(126, 126);
    this.add.image(500, 350, 'characters', `ball_${copy.targetLevel}`).setDisplaySize(126, 126);
    this.add.text(360, 350, '→', { fontFamily: FONT_FAMILY, fontSize: '43px', color: '#ac997c' }).setOrigin(0.5);
    this.add.text(220, 443, copy.actual, { fontFamily: FONT_FAMILY, fontSize: '25px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(500, 443, copy.target, { fontFamily: FONT_FAMILY, fontSize: '25px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
    const stamp = this.add.text(360, 503, copy.gap, { fontFamily: FONT_FAMILY, fontSize: '27px', color: '#547044', backgroundColor: '#edf1e3', padding: { x: 18, y: 9 } }).setOrigin(0.5);
    const progress = copy.resonance || '每次重试，都有一条新的下班路线';
    this.add.text(360, 557, progress, { fontFamily: FONT_FAMILY, fontSize: '22px', color: '#8b6041' }).setOrigin(0.5);
    const rule = this.add.graphics().lineStyle(2, 0xd9c8a5);
    for (let x = 80; x < 640; x += 24) rule.lineBetween(x, 600, x + 12, 600);
    const values = ['0', String(levelSummary.merges), String(levelSummary.bestCombo)];
    const labels = ['本关快乐值', '本关合成', '本关最高连合'];
    let score: Phaser.GameObjects.Text | undefined;
    for (let i = 0; i < 3; i++) {
      const x = 156 + i * 204;
      const value = this.add.text(x, 653, values[i], { fontFamily: FONT_FAMILY, fontSize: '39px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
      if (i === 0) score = value;
      this.add.text(x, 698, labels[i], { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' }).setOrigin(0.5);
    }
    this.add.text(360, 756, `本轮累计 ${state.score} 快乐值 · ${summary.merges} 次合成`, { fontFamily: FONT_FAMILY, fontSize: '21px', color: '#8b7c64' }).setOrigin(0.5);
    const record = this.add.text(360, 790, '', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' }).setOrigin(0.5);
    let advice = copy.advice;
    if (this.won && this.reward) {
      const names = { document: '文件', coffee: '咖啡', package: '快递', keyboard: '键盘', mouse: '鼠标', plant: '绿植' };
      const item = this.reward.items[0];
      advice = `本关奖励：${item.level}级${names[item.type]} ×${this.reward.items.length} · +${this.reward.coins}币\n物品已寄存，去工位合出下一位搭子`;
    }
    this.add.text(360, 868, advice, { fontFamily: FONT_FAMILY, fontSize: '23px', color: ink, align: 'center', wordWrap: { width: 510 }, lineSpacing: 10 }).setOrigin(0.5);
    const report = this.add.container(0, 20, this.children.list.slice(start)).setAlpha(0);
    this.tweens.add({ targets: report, y: 0, alpha: 1, duration: 400, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: hero, y: hero.y - 7, angle: 3, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    stamp.setScale(1.12).setAlpha(0);
    this.tweens.add({ targets: stamp, scaleX: 1, scaleY: 1, alpha: 1, delay: 350, duration: 200, ease: 'Cubic.easeIn' });
    const counter = { value: 0 };
    this.tweens.add({ targets: counter, value: levelSummary.score, duration: 700, ease: 'Cubic.easeOut', onUpdate: () => score?.setText(String(Math.floor(counter.value))), onComplete: () => score?.setText(String(levelSummary.score)) });
    if (this.won) {
      const celebration = this.add.container(0, 0).setDepth(20);
      paperConfetti(this, celebration);
    }

    button(this, 360, 1010, 590, this.won ? '去工位，看看搭子' : `再试第 ${state.currentLevel} 关`, () => {
      if (this.restarting) return;
      this.restarting = true;
      if (this.won) {
        this.scene.start('WorkstationScene', { gameController: this.gameController, gameConfig: this.gameConfig, afterimageMode: this.afterimageMode });
        return;
      }
      this.gameController.retryLevel();
      this.scene.start('MainScene', { gameController: this.gameController, gameConfig: this.gameConfig, afterimageMode: this.afterimageMode });
    });
    button(this, 205, 1120, 280, this.won ? '再挑战一次' : '去我的工位', () => {
      if (this.won) { this.restart(); return; }
      if (this.restarting) return;
      this.restarting = true;
      this.scene.start('WorkstationScene', { gameController: this.gameController, gameConfig: this.gameConfig, afterimageMode: this.afterimageMode });
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
    try {
      const stored = Number(await platform.loadData(recordKey));
      const previous = Number.isFinite(stored) ? Math.max(0, stored) : 0;
      const best = Math.max(previous, state.score);
      await platform.saveData(recordKey, String(best));
      if (label.active) label.setText(state.score > previous ? `新纪录！个人最佳 ${best}` : `个人最佳 ${best}`);
    } catch {
      if (label.active) label.setText('个人纪录暂未保存');
    }
  }

  private restart() {
    if (this.restarting) return;
    this.restarting = true;
    this.gameController.reset();
    this.scene.start('MainScene', { gameController: this.gameController, gameConfig: this.gameConfig, afterimageMode: this.afterimageMode });
  }
}
