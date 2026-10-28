import Phaser from 'phaser';
import classicLevels from '../config/levelConfig.json';
import afterimageLevels from '../config/afterimageLevels.json';
import { GameController } from '../core/GameController';
import { GameConfig, type LevelConfig } from '../types';
import { button, ink, panel, paper, FONT_FAMILY, characterNames } from '../ui/theme';
import { setupHiDpi } from '../ui/hidpi';
import { loadOfficeArt, officeProp, itemFrames } from '../ui/officeArt';
import { WorkstationManager } from '../core/WorkstationManager';
import { stageKey, stageRewardPreview, type StageRecord, type JourneyMode } from '../core/JourneyProgress';
import { getPlatform } from '../platform';
import { routeProgress } from '../ui/routeProgress';
import { boardPreview } from '../ui/boardPreview';

export class HomeScene extends Phaser.Scene {
  private gameController!: GameController;
  private gameConfig!: GameConfig;
  private records: Record<string, StageRecord> = {};
  private pendingItems = 0;
  private progressLoaded = false;
  private progressFailed = false;
  private view: 'home' | JourneyMode = 'home';
  private viewVersion = 0;
  private homeProgress?: Phaser.GameObjects.Text;
  private shadowProgress?: Phaser.GameObjects.Text;
  private workstationProgress?: Phaser.GameObjects.Text;
  private stageOverlay?: Phaser.GameObjects.Container;
  private stageIndex?: number;
  private leaving = false;
  private routeMode?: JourneyMode;
  private coinBalance?: Phaser.GameObjects.Text;
  private nextStageText?: Phaser.GameObjects.Text;
  private primaryActionText?: Phaser.GameObjects.Text;
  private routeMarks: Phaser.GameObjects.Rectangle[] = [];
  private rewardDot?: Phaser.GameObjects.Arc;

  constructor() { super({ key: 'HomeScene' }); }

  init(data: { gameController: GameController; gameConfig: GameConfig; routeMode?: JourneyMode }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
    this.records = {};
    this.pendingItems = 0;
    this.progressLoaded = false;
    this.progressFailed = false;
    this.view = 'home';
    this.viewVersion++;
    this.homeProgress = undefined;
    this.shadowProgress = undefined;
    this.workstationProgress = undefined;
    this.stageOverlay = undefined;
    this.stageIndex = undefined;
    this.leaving = false;
    this.routeMode = data.routeMode;
    this.coinBalance = undefined;
    this.nextStageText = undefined;
    this.primaryActionText = undefined;
    this.routeMarks = [];
    this.rewardDot = undefined;
  }

  preload() { loadOfficeArt(this); }

  create() {
    setupHiDpi(this);
    const version = this.viewVersion;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.viewVersion++);
    // 保留暖色办公室插画，用奶油色过渡承托状态和主操作。
    this.add.rectangle(360, 640, 720, 1280, 0xf4efdf);
    this.add.image(360, 390, 'office-room').setDisplaySize(720, 820);
    const atmosphere = this.add.graphics();
    atmosphere.fillStyle(0xf4efdf, 0.05).fillRect(0, 0, 720, 820);
    atmosphere.fillGradientStyle(0xf4efdf, 0xf4efdf, 0xf4efdf, 0xf4efdf, 0.95, 0.95, 0.1, 0.1).fillRect(0, 0, 720, 390);
    atmosphere.fillGradientStyle(0xf4efdf, 0xf4efdf, 0xf4efdf, 0xf4efdf, 0, 0, 1, 1).fillRect(0, 425, 720, 430);
    atmosphere.lineStyle(1, 0xb4a286, 0.3).lineBetween(36, 92, 684, 92);
    atmosphere.lineStyle(1, 0xb4a286, 0.06);
    for (let x = 36; x < 720; x += 72) atmosphere.lineBetween(x, 820, x, 1280);

    const emblem = this.add.graphics().lineStyle(2, 0xaf8555);
    emblem.strokeRect(-14, -14, 28, 28).lineBetween(-6, 0, 6, 0).lineBetween(0, -6, 0, 6).setPosition(57, 52).setAngle(45);
    this.add.text(90, 32, '下班团子', { fontFamily: FONT_FAMILY, fontSize: '28px', fontStyle: 'bold', color: '#49392d' });
    this.add.text(92, 65, 'MOCHI OFFICE', { fontFamily: FONT_FAMILY, fontSize: '12px', color: '#8b7c64', letterSpacing: 3 });
    this.add.rectangle(600, 51, 168, 48, 0xf4efdf, 0.65).setStrokeStyle(1, 0xb4a286, 0.35);
    officeProp(this, 543, 51, 7, 34);
    this.coinBalance = this.add.text(662, 51, '—', { fontFamily: FONT_FAMILY, fontSize: '24px', color: '#6d795a' }).setOrigin(1, 0.5);

    this.add.text(38, 121, '下班事务所  /  轻松一刻', { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#8b7c64', letterSpacing: 1 });
    this.add.text(36, 156, '准点下班计划', { fontFamily: FONT_FAMILY, fontSize: '54px', color: '#49392d', fontStyle: 'bold' });
    this.add.text(40, 229, '碰掉坏情绪，合出你的下班搭子。', { fontFamily: FONT_FAMILY, fontSize: '22px', color: '#6d795a' });
    this.add.rectangle(39, 301, 4, 32, 0xaf8555);
    this.add.text(55, 286, '弹射 × 合成 × 工位养成', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#6d795a' });

    // 团子与轨道独立浮动，场景不移动，避免按钮跟随装饰动画漂移。
    const orbit = this.add.graphics().lineStyle(1, 0xaf8555, 0.34);
    orbit.strokeCircle(0, 0, 204).strokeCircle(0, 0, 216).setPosition(391, 505).setScale(1, 0.7).setAngle(-18);
    const marker = this.add.graphics().fillStyle(0xd39a65).fillRect(190, -5, 10, 10).setPosition(391, 505);
    this.tweens.add({ targets: marker, angle: 360, duration: 30000, repeat: -1 });
    this.add.graphics().fillStyle(0x6e5840, 0.42).fillEllipse(408, 638, 330, 54);
    const companion = this.add.image(236, 532, 'characters', 'ball_2').setDisplaySize(175, 175).setAngle(-14);
    const mochi = this.add.image(447, 468, 'characters', 'ball_1').setDisplaySize(300, 300).setAngle(8).setInteractive({ useHandCursor: true });
    const frog = this.add.image(566, 594, 'characters', 'ball_4').setDisplaySize(128, 128).setAngle(14);
    this.tweens.add({ targets: companion, y: 544, angle: -8, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: mochi, y: 452, angle: 3, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: frog, y: 582, angle: 8, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    mochi.on('pointerdown', () => {
      if (this.leaving) return;
      const note = this.add.text(360, 345, '今天的情绪，也能合成好心情。', { fontFamily: FONT_FAMILY, fontSize: '21px', color: '#49392d', backgroundColor: '#ede4d0', padding: { x: 18, y: 10 } }).setOrigin(0.5);
      this.tweens.add({ targets: note, y: 320, alpha: 0, delay: 850, duration: 350, onComplete: () => note.destroy() });
    });

    // 进度与下一步操作组成同一个任务面板，玩家无需先进入地图再开始。
    this.lobbyPanel(36, 711, 648, 285, 0xfffcf2);
    this.add.text(60, 733, '下班路线', { fontFamily: FONT_FAMILY, fontSize: '24px', color: '#49392d', fontStyle: 'bold' });
    this.homeProgress = this.add.text(656, 738, '读取记录中…', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#6d795a' }).setOrigin(1, 0);
    for (let i = 0; i < classicLevels.length; i++) {
      this.routeMarks.push(this.add.rectangle(94 + i * 76, 786, 65, 5, 0xe4dbc7));
    }
    this.nextStageText = this.add.text(60, 813, '下一站 · 刚到工位', { fontFamily: FONT_FAMILY, fontSize: '23px', color: '#8b7c64' });
    const map = this.add.text(655, 827, '关卡地图  ›', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#94623d', padding: { x: 12, y: 15 } }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    map.on('pointerdown', () => this.showRoute(false));
    this.primaryActionText = this.lobbyButton(360, 924, 600, '开始闯关', () => this.continueRoute());
    this.shadowProgress = this.modeCard(36, 1020, '残影实验室', '轨迹成路 · 同款共鸣', 4, () => this.showRoute(true));
    this.workstationProgress = this.modeCard(370, 1020, '我的工位', '合成物资 · 招募搭子', 2, () => this.goToWorkstation());
    this.rewardDot = this.add.circle(658, 1044, 6, 0xc77a4f).setVisible(false);
    this.add.text(360, 1244, '每次通关，都让理想工位更近一步', { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#8b7c64' }).setOrigin(0.5);
    this.cameras.main.fadeIn(350, 244, 239, 223);
    void this.loadProgress(version);
    if (this.routeMode) this.showRoute(this.routeMode === 'afterimage');
  }

  private lobbyPanel(x: number, y: number, width: number, height: number, color: number) {
    const shape = this.add.graphics();
    shape.fillStyle(0x705a42, 0.12).fillRoundedRect(x, y + 5, width, height, 20);
    shape.fillStyle(color, 0.97).fillRoundedRect(x, y, width, height, 20);
    shape.lineStyle(2, 0xb4a286, 0.85).strokeRoundedRect(x, y, width, height, 20);
    return shape;
  }

  private lobbyButton(x: number, y: number, width: number, title: string, action: () => void) {
    const container = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x9b7454).fillRoundedRect(-width / 2, -35, width, 80, 20);
    bg.fillStyle(0xee976e).fillRoundedRect(-width / 2, -40, width, 80, 20);
    bg.lineStyle(1, 0xffe2bd, 0.8).strokeRoundedRect(-width / 2 + 2, -38, width - 4, 76, 18);
    const label = this.add.text(-18, 0, title, { fontFamily: FONT_FAMILY, fontSize: '29px', color: '#49392d', fontStyle: 'bold' }).setOrigin(0.5);
    const arrow = this.add.text(width / 2 - 36, -2, '›', { fontFamily: FONT_FAMILY, fontSize: '42px', color: '#49392d' }).setOrigin(0.5);
    container.add([bg, label, arrow]).setSize(width, 80).setInteractive({ useHandCursor: true });
    container.on('pointerover', () => bg.setAlpha(0.86));
    container.on('pointerout', () => bg.setAlpha(1));
    container.on('pointerdown', () => {
      if (this.leaving) return;
      action();
    });
    return label;
  }

  private modeCard(x: number, y: number, title: string, hint: string, level: number, action: () => void) {
    const start = this.children.length;
    const surface = this.lobbyPanel(x, y, 314, 178, 0xfffcf2);
    this.add.image(x + 266, y + 56, 'characters', `ball_${level}`).setDisplaySize(64, 64).setAlpha(0.8);
    this.add.text(x + 22, y + 28, title, { fontFamily: FONT_FAMILY, fontSize: '27px', color: '#49392d', fontStyle: 'bold' });
    const subtitle = this.add.text(x + 22, y + 82, hint, { fontFamily: FONT_FAMILY, fontSize: '19px', color: '#8b7c64' });
    this.add.text(x + 22, y + 127, '进入  ›', { fontFamily: FONT_FAMILY, fontSize: '21px', color: '#94623d' });
    const card = this.add.container(0, 0, this.children.list.slice(start));
    const hit = this.add.rectangle(x + 157, y + 89, 314, 178, 0xffffff, 0).setInteractive({ useHandCursor: true });
    card.add(hit);
    hit.on('pointerover', () => surface.setAlpha(0.8));
    hit.on('pointerout', () => surface.setAlpha(1));
    hit.on('pointerdown', action);
    return subtitle;
  }

  private continueRoute() {
    const progress = routeProgress('classic', classicLevels, this.records);
    this.startMode(false, progress.nextIndex);
  }

  private async loadProgress(version: number) {
    try {
      const system = await WorkstationManager.getInstance(getPlatform()).getSystem();
      if (version !== this.viewVersion || this.leaving) return;
      const state = system.getState();
      const journey = state.journey;
      if (this.view === 'home') this.coinBalance?.setText(String(Math.floor(state.coins)));
      this.records = { ...journey?.records };
      const rewards = journey?.pendingRewards ?? [];
      this.pendingItems = 0;
      this.progressFailed = false;
      for (let i = 0; i < rewards.length; i++) this.pendingItems += rewards[i].items.length;
      this.progressLoaded = true;
    } catch {
      if (version !== this.viewVersion || this.leaving) return;
      this.progressFailed = true;
    }

    if (this.view !== 'home') {
      const shadow = this.view === 'afterimage';
      const stageIndex = this.stageIndex;
      this.showRoute(shadow);
      if (stageIndex !== undefined) this.showStageBrief(shadow, stageIndex);
      return;
    }
    if (this.progressFailed) {
      this.homeProgress?.setText('读取失败 · 点击重试').setInteractive({ useHandCursor: true }).once('pointerdown', () => {
        this.homeProgress?.disableInteractive().setText('读取记录中…');
        void this.loadProgress(this.viewVersion);
      });
      return;
    }
    const classic = routeProgress('classic', classicLevels, this.records);
    const shadow = routeProgress('afterimage', afterimageLevels, this.records);
    this.homeProgress?.setText(`已完成 ${classic.cleared} / ${classicLevels.length}`);
    this.shadowProgress?.setText(`已完成 ${shadow.cleared} / ${afterimageLevels.length} 关`);
    const next = classicLevels[classic.nextIndex];
    this.nextStageText?.setText(`下一站 ${String(next.level).padStart(2, '0')} · ${next.title}`);
    this.primaryActionText?.setText(`继续闯关 · 第 ${next.level} 关`);
    if (classic.cleared === 0) this.primaryActionText?.setText('开始闯关');
    if (classic.complete) {
      this.nextStageText?.setText('全线通关 · 向更好的成绩出发');
      this.primaryActionText?.setText('再次挑战');
    }
    for (let i = 0; i < this.routeMarks.length; i++) {
      const cleared = (this.records[stageKey('classic', classicLevels[i].level)]?.clears ?? 0) > 0;
      this.routeMarks[i].setFillStyle(cleared ? 0x7f9867 : 0xe4dbc7);
    }
    if (this.pendingItems > 0) {
      this.workstationProgress?.setText(`${this.pendingItems} 件通关物资待领取`).setColor('#a66a40');
      this.rewardDot?.setVisible(true);
    }
  }

  private showRoute(shadow: boolean) {
    if (this.leaving) return;
    this.view = shadow ? 'afterimage' : 'classic';
    this.stageOverlay = undefined;
    this.stageIndex = undefined;
    this.tweens.killAll();
    this.children.removeAll(true);
    paper(this);
    this.add.image(360, 180, 'office-room').setDisplaySize(720, 720).setAlpha(0.12);
    const levels = shadow ? afterimageLevels : classicLevels;
    const progress = routeProgress(this.view, levels, this.records);
    this.add.text(36, 35, '‹ 返回事务所', { fontFamily: FONT_FAMILY, fontSize: '24px', color: ink, padding: { x: 8, y: 10 } }).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.restart({ gameController: this.gameController, gameConfig: this.gameConfig }));
    this.add.text(42, 101, shadow ? '残影实验室' : '一周下班计划', { fontFamily: FONT_FAMILY, fontSize: '44px', color: ink, fontStyle: 'bold' });
    this.add.image(634, 119, 'characters', shadow ? 'ball_4' : 'ball_1').setDisplaySize(86, 86).setAngle(8);
    this.lobbyPanel(36, 172, 648, 128, 0xfffcf2);
    let status = '正在读取通关记录…';
    if (this.progressLoaded) status = `已通关 ${progress.cleared} / ${levels.length}`;
    if (progress.complete && this.progressLoaded) status = '全线通关！好心情收集完成';
    if (this.progressFailed) status = '读取失败 · 点这里重试';
    const statusText = this.add.text(60, 191, status, { fontFamily: FONT_FAMILY, fontSize: '25px', color: '#62794e', fontStyle: 'bold' });
    this.add.text(656, 198, '通关得物资', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' }).setOrigin(1, 0);
    const segment = 588 / levels.length;
    for (let i = 0; i < levels.length; i++) {
      const cleared = (this.records[stageKey(this.view, levels[i].level)]?.clears ?? 0) > 0;
      this.add.rectangle(60 + i * segment, 246, segment - 8, 12, cleared ? 0x8fa775 : 0xe8dfcc).setOrigin(0, 0.5);
    }
    this.add.text(60, 267, '✓ 已通关     ● 下一站     点关卡看布局与奖励', { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#8b7c64' });
    if (this.progressFailed) statusText.setInteractive({ useHandCursor: true }).once('pointerdown', () => {
      statusText.disableInteractive().setText('正在读取通关记录…');
      void this.loadProgress(this.viewVersion);
    });

    // 蛇形路线连接关卡卡片；盖章只取本关记录，跳关不会点亮中间路段。
    const points = levels.map((_, i) => {
      if (shadow) return { x: i % 2 === 0 ? 190 : 530, y: 408 + i * 180 };
      const row = Math.floor(i / 2);
      const right = (i % 2 === 1) !== (row % 2 === 1);
      return { x: right ? 530 : 190, y: 408 + row * 180 };
    });
    const road = this.add.graphics();
    for (let i = 1; i < points.length; i++) {
      const previous = points[i - 1];
      const current = points[i];
      const previousCleared = (this.records[stageKey(this.view, levels[i - 1].level)]?.clears ?? 0) > 0;
      const currentCleared = (this.records[stageKey(this.view, levels[i].level)]?.clears ?? 0) > 0;
      road.lineStyle(18, 0xe1d6bd).lineBetween(previous.x, previous.y, current.x, current.y);
      road.lineStyle(7, previousCleared && currentCleared ? 0x9fb380 : 0xfaf5e7).lineBetween(previous.x, previous.y, current.x, current.y);
      const arrow = current.x >= previous.x ? '›' : '‹';
      if (current.y === previous.y) this.add.text(360, current.y - 3, arrow, { fontFamily: FONT_FAMILY, fontSize: '32px', color: '#9b896b' }).setOrigin(0.5);
    }
    const itemNames = { document: '文件', coffee: '咖啡', package: '快递', keyboard: '键盘', mouse: '鼠标', plant: '绿植' };
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const { x, y } = points[i];
      const left = x - 148;
      const top = y - 78;
      const record = this.records[stageKey(this.view, level.level)];
      const cleared = (record?.clears ?? 0) > 0;
      const next = this.progressLoaded && !progress.complete && i === progress.nextIndex;
      let fill = 0xfffcf2;
      if (cleared) fill = 0xf0f4e5;
      if (next) fill = 0xffecd4;
      this.lobbyPanel(left, top, 296, 156, fill);
      if (next) {
        const ring = this.add.graphics().lineStyle(3, 0xda9560).strokeRoundedRect(left - 3, top - 3, 302, 162, 22);
        this.tweens.add({ targets: ring, alpha: 0.35, duration: 1100, yoyo: true, repeat: -1 });
      }
      this.add.circle(left + 47, top + 46, 31, cleared ? 0xcbdab3 : 0xf0debb).setStrokeStyle(2, 0xa89570);
      this.add.image(left + 47, top + 43, 'characters', `ball_${level.targetBallLevel ?? 2}`).setDisplaySize(53, 53);
      this.add.text(left + 47, top + 69, String(level.level).padStart(2, '0'), { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#fffaf0', backgroundColor: '#887358', padding: { x: 6, y: 1 } }).setOrigin(0.5);
      this.add.text(left + 91, top + 18, level.title, { fontFamily: FONT_FAMILY, fontSize: '24px', color: ink, fontStyle: 'bold' });
      let state = `${level.shots} 发 · 自由挑战`;
      if (cleared) state = `✓ 已通关 · 最少 ${record.fewestShots} 发`;
      if (next) state = `下一站 · ${level.shots} 发挑战`;
      this.add.text(left + 91, top + 54, state, { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#62794e' });
      const reward = stageRewardPreview(this.view, level.level);
      officeProp(this, left + 27, top + 112, itemFrames[reward.type], 34);
      let rewardText = `首通 ${reward.itemLevel}级${itemNames[reward.type]} ×2`;
      if (cleared) rewardText = `复通 ${reward.itemLevel}级${itemNames[reward.type]} ×1`;
      if (!this.progressLoaded) rewardText = `${reward.itemLevel}级${itemNames[reward.type]} · 首通双份`;
      this.add.text(left + 50, top + 99, rewardText, { fontFamily: FONT_FAMILY, fontSize: '19px', color: '#94623d' });
      let detail = '点开查看目标与奖励  ›';
      if (cleared) detail = `最佳 ${record.bestScore} 分 · ${record.bestCombo} 连合`;
      this.add.text(left + 18, top + 130, detail, { fontFamily: FONT_FAMILY, fontSize: '17px', color: '#8b7c64' });
      const hit = this.add.rectangle(x, y, 296, 156, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.showStageBrief(shadow, i));
    }
    if (shadow) {
      const captions = ['留下轨迹\n同款再相遇', '本关 3 连合\n再加 10 币', '通关带回物资\n招募下班搭子', '最后一站\n挑战残影派对'];
      for (let i = 0; i < points.length; i++) {
        const x = points[i].x === 190 ? 530 : 190;
        officeProp(this, x, points[i].y - 22, i % 3 + 1, 58).setAlpha(0.7);
        this.add.text(x, points[i].y + 26, captions[i], { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64', align: 'center', lineSpacing: 5 }).setOrigin(0.5, 0);
      }
    }
    const endY = points[points.length - 1].y + 110;
    this.add.text(360, endY, '首通双份物资 · 复通可补货 · 3 连合再加 10 币', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' }).setOrigin(0.5);
    let action = `继续第 ${levels[progress.nextIndex].level} 关  →`;
    if (progress.complete) action = '全线盖章！再闯一次  →';
    if (!this.progressLoaded) action = '从第一关开始  →';
    button(this, 360, 1140, 620, action, () => this.startMode(shadow, progress.nextIndex));
    this.add.text(360, 1230, '从头连闯，沿途选卡  →', { fontFamily: FONT_FAMILY, fontSize: '23px', color: '#8b6041', padding: { x: 24, y: 14 } }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.startMode(shadow));
    this.cameras.main.fadeIn(250, 244, 239, 223);
  }

  private showStageBrief(shadow: boolean, index: number) {
    if (this.stageOverlay || this.leaving) return;
    const mode = shadow ? 'afterimage' : 'classic';
    const stage: LevelConfig = (shadow ? afterimageLevels : classicLevels)[index];
    const record = this.records[stageKey(mode, stage.level)];
    const cleared = (record?.clears ?? 0) > 0;
    const reward = stageRewardPreview(mode, stage.level);
    const itemNames = { document: '文件', coffee: '咖啡', package: '快递', keyboard: '键盘', mouse: '鼠标', plant: '绿植' };
    this.stageIndex = index;
    const start = this.children.length;
    const shade = this.add.rectangle(360, 640, 720, 1280, 0x49392d, 0.5).setInteractive();
    shade.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    panel(this, 50, 155, 620, 1000);
    this.add.text(86, 189, `${String(stage.level).padStart(2, '0')} / ${stage.title}`, { fontFamily: FONT_FAMILY, fontSize: '32px', color: ink, fontStyle: 'bold' });
    let target = `目标：${characterNames[stage.targetBallLevel ?? 2]} · ${stage.shots} 发`;
    if (stage.requiredAfterimageMerges) target += ` · 共鸣 ${stage.requiredAfterimageMerges} 次`;
    this.add.text(86, 251, target, { fontFamily: FONT_FAMILY, fontSize: '22px', color: '#6d795a' });
    boardPreview(this, stage, 80, 305, 270, 338);
    if (cleared) {
      const values = [String(record.bestScore), `${record.bestCombo} 连合`, `${record.fewestShots} 发`];
      const labels = ['最佳本关快乐值', '最高连合', '最少用球'];
      for (let i = 0; i < values.length; i++) {
        this.add.text(500, 333 + i * 100, labels[i], { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' }).setOrigin(0.5);
        this.add.text(500, 376 + i * 100, values[i], { fontFamily: FONT_FAMILY, fontSize: '34px', color: '#547044', fontStyle: 'bold' }).setOrigin(0.5);
      }
    } else {
      let status = this.progressLoaded ? '尚未通关' : '记录读取中';
      if (this.progressFailed) status = '记录暂不可用';
      this.add.text(500, 405, status, { fontFamily: FONT_FAMILY, fontSize: '29px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
      const hint = this.progressLoaded ? '第一次通关\n带回双份物资' : '读取记录后\n显示个人最佳';
      this.add.text(500, 475, hint, { fontFamily: FONT_FAMILY, fontSize: '23px', color: '#8b7c64', align: 'center', lineSpacing: 12 }).setOrigin(0.5);
    }
    this.add.text(360, 700, stage.hint ?? '先找同款，再安排下一球', { fontFamily: FONT_FAMILY, fontSize: '23px', color: ink, wordWrap: { width: 530 }, align: 'center', lineSpacing: 8 }).setOrigin(0.5);
    const count = cleared ? reward.repeatCount : reward.firstClearCount;
    const coins = cleared ? reward.repeatCoins : reward.firstClearCoins;
    let rewardTitle = cleared ? '复通补给 · 再带一份回工位' : '首通礼包 · 双份物资带回家';
    if (!this.progressLoaded) rewardTitle = '通关补给 · 首通双份 / 复通单份';
    this.add.text(88, 766, rewardTitle, { fontFamily: FONT_FAMILY, fontSize: '24px', color: '#547044', fontStyle: 'bold' });
    this.lobbyPanel(80, 808, 325, 122, 0xeaf0df);
    this.lobbyPanel(420, 808, 220, 122, 0xffedd6);
    officeProp(this, 129, 866, itemFrames[reward.type], 76);
    let material = `${reward.itemLevel}级${itemNames[reward.type]} ×${count}`;
    let coinLabel = `+${coins} 币`;
    if (!this.progressLoaded) {
      material = `${reward.itemLevel}级${itemNames[reward.type]}`;
      coinLabel = '首通 / 复通';
    }
    this.add.text(181, 839, material, { fontFamily: FONT_FAMILY, fontSize: '24px', color: ink, fontStyle: 'bold' });
    this.add.text(181, 879, '合成物资，招募搭子', { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#6d795a' });
    officeProp(this, 463, 866, 7, 54);
    this.add.text(505, 838, coinLabel, { fontFamily: FONT_FAMILY, fontSize: '25px', color: ink, fontStyle: 'bold' });
    let coinHint = '解锁更多工位';
    if (!this.progressLoaded) coinHint = `${reward.firstClearCoins} / ${reward.repeatCoins} 币`;
    this.add.text(505, 881, coinHint, { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#94623d' });
    this.add.text(360, 969, `本关 3 连合，额外再得 ${reward.comboBonus} 币`, { fontFamily: FONT_FAMILY, fontSize: '21px', color: '#8b7c64' }).setOrigin(0.5);
    button(this, 360, 1040, 520, cleared ? '再挑战，刷新纪录  →' : `挑战第 ${stage.level} 关  →`, () => this.startMode(shadow, index));
    this.add.text(360, 1116, '物资在工位领取 · 最佳成绩分别保留', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' }).setOrigin(0.5);
    const close = this.add.text(630, 191, '×', { fontFamily: FONT_FAMILY, fontSize: '36px', color: ink }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.stageOverlay = this.add.container(0, 0, this.children.list.slice(start)).setDepth(50);
    close.on('pointerdown', () => {
      this.stageOverlay?.destroy(true);
      this.stageOverlay = undefined;
      this.stageIndex = undefined;
    });
    this.stageOverlay.setAlpha(0);
    this.tweens.add({ targets: this.stageOverlay, alpha: 1, duration: 180 });
  }

  private goToWorkstation() {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start('WorkstationScene', { gameController: this.gameController, gameConfig: this.gameConfig });
  }

  private startMode(afterimageMode: boolean, stage = 0) {
    if (this.leaving) return;
    this.leaving = true;
    this.gameController.startRun(afterimageMode ? afterimageLevels : classicLevels);
    for (let i = 0; i < stage; i++) this.gameController.advanceLevel();
    this.scene.start('MainScene', { gameController: this.gameController, gameConfig: this.gameConfig, afterimageMode });
  }
}
