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
  }

  preload() { loadOfficeArt(this); }

  create() {
    setupHiDpi(this);
    const version = this.viewVersion;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.viewVersion++);
    paper(this);
    this.add.image(360, 410, 'office-room').setDisplaySize(720, 820);
    this.add.rectangle(360, 146, 720, 292, 0xf5eddb);
    this.add.text(42, 48, 'MOCHI OFFICE  /  下班事务所', { fontFamily: FONT_FAMILY, fontSize: '19px', color: '#6d795a' });
    this.add.text(42, 94, '今天，也要\n准点下班。', { fontFamily: FONT_FAMILY, fontSize: '62px', color: ink, fontStyle: 'bold', lineSpacing: 4 });
    this.add.text(46, 264, '碰掉坏情绪，把小日子合成喜欢的样子', { fontFamily: FONT_FAMILY, fontSize: '21px', color: '#8b7c64' });
    const stamp = this.add.text(612, 148, '拒绝\n内耗', { fontFamily: FONT_FAMILY, fontSize: '24px', color: '#b26245', align: 'center', backgroundColor: '#fff4da', padding: { x: 16, y: 12 } }).setOrigin(0.5).setAngle(10);
    this.tweens.add({ targets: stamp, angle: 6, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const mochi = this.add.image(545, 606, 'characters', 'ball_1').setDisplaySize(115, 115).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: mochi, y: 598, angle: -4, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    mochi.on('pointerdown', () => {
      this.tweens.add({ targets: mochi, scaleX: mochi.scaleX * 1.12, scaleY: mochi.scaleY * 0.9, duration: 120, yoyo: true });
      const note = this.add.text(470, 507, '摸鱼也是充电', { fontFamily: FONT_FAMILY, fontSize: '22px', color: ink, backgroundColor: '#fff9e7', padding: { x: 12, y: 8 } }).setOrigin(0.5);
      this.tweens.add({ targets: note, y: 480, alpha: 0, delay: 900, duration: 400, onComplete: () => note.destroy() });
    });

    panel(this, 30, 735, 660, 210);
    this.add.text(58, 760, '01  下班闯关', { fontFamily: FONT_FAMILY, fontSize: '32px', color: ink, fontStyle: 'bold' });
    this.homeProgress = this.add.text(60, 806, '正在读取你的下班路线…', { fontFamily: FONT_FAMILY, fontSize: '21px', color: '#8b7c64' });
    button(this, 360, 892, 590, '打开打工路线  →', () => this.showRoute(false));
    this.shadowProgress = this.modeCard(30, 976, '02  残影实验室', '轨迹成路，同款共鸣', 4, () => this.showRoute(true));
    this.workstationProgress = this.modeCard(370, 976, '03  我的工位', '通关得物资，合成招搭子', 2, () => this.goToWorkstation());
    this.add.text(360, 1230, '慢一点也没关系，总会合出好心情', { fontFamily: FONT_FAMILY, fontSize: '19px', color: '#8b7c64' }).setOrigin(0.5);
    this.cameras.main.fadeIn(350, 244, 239, 223);
    void this.loadProgress(version);
    if (this.routeMode) this.showRoute(this.routeMode === 'afterimage');
  }

  private modeCard(x: number, y: number, title: string, hint: string, level: number, action: () => void) {
    panel(this, x, y, 320, 210, level === 4 ? 0xe8efdf : 0xffedd6);
    const face = this.add.image(x + 270, y + 52, 'characters', `ball_${level}`).setDisplaySize(60, 60);
    this.tweens.add({ targets: face, angle: 7, duration: 1800, yoyo: true, repeat: -1 });
    this.add.text(x + 22, y + 30, title, { fontFamily: FONT_FAMILY, fontSize: '26px', color: ink, fontStyle: 'bold' });
    const subtitle = this.add.text(x + 22, y + 82, hint, { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' });
    button(this, x + 160, y + 158, 268, '进去看看  →', action);
    return subtitle;
  }

  private async loadProgress(version: number) {
    try {
      const system = await WorkstationManager.getInstance(getPlatform()).getSystem();
      if (version !== this.viewVersion || this.leaving) return;
      const journey = system.getState().journey;
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
      this.homeProgress?.setText('记录暂未读取 · 点这里重试，仍可挑战').setInteractive({ useHandCursor: true }).once('pointerdown', () => {
        this.homeProgress?.disableInteractive().setText('正在读取你的下班路线…');
        void this.loadProgress(this.viewVersion);
      });
      return;
    }
    const classic = routeProgress('classic', classicLevels, this.records);
    const shadow = routeProgress('afterimage', afterimageLevels, this.records);
    this.homeProgress?.setText(`已通关 ${classic.cleared} / ${classicLevels.length} · 过关带物资，回工位养搭子`);
    this.shadowProgress?.setText(`已通关 ${shadow.cleared} / ${afterimageLevels.length} · 同款共鸣`);
    if (this.pendingItems > 0) this.workstationProgress?.setText(`${this.pendingItems} 件通关物资待领取`);
  }

  private showRoute(shadow: boolean) {
    if (this.leaving) return;
    this.view = shadow ? 'afterimage' : 'classic';
    this.stageOverlay = undefined;
    this.stageIndex = undefined;
    this.tweens.killAll();
    this.children.removeAll(true);
    paper(this);
    const levels = shadow ? afterimageLevels : classicLevels;
    const progress = routeProgress(this.view, levels, this.records);
    this.add.text(42, 48, '← 事务所', { fontFamily: FONT_FAMILY, fontSize: '24px', color: ink }).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.restart({ gameController: this.gameController, gameConfig: this.gameConfig }));
    this.add.text(42, 112, shadow ? '残影实验室' : '一周下班计划', { fontFamily: FONT_FAMILY, fontSize: '48px', color: ink, fontStyle: 'bold' });
    let status = '正在读取通关记录…';
    if (this.progressLoaded) status = `已盖章 ${progress.cleared} / ${levels.length} · 每个工位都留下你的成绩`;
    if (this.progressFailed) status = '记录暂未读取 · 点这里重试，仍可挑战';
    const statusText = this.add.text(44, 183, status, { fontFamily: FONT_FAMILY, fontSize: '23px', color: '#6d795a' });
    if (this.progressFailed) statusText.setInteractive({ useHandCursor: true }).once('pointerdown', () => {
      statusText.disableInteractive().setText('正在读取通关记录…');
      void this.loadProgress(this.viewVersion);
    });
    this.add.text(44, 224, '点节点看奖励和最佳成绩 · 可自由挑战', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' });
    const points = levels.map((_, i) => ({ x: i % 2 === 0 ? 174 : 546, y: 325 + i * (shadow ? 210 : 98) }));
    const path = this.add.graphics().lineStyle(12, 0xd6debe, 1);
    for (let i = 1; i < points.length; i++) path.lineBetween(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    for (let i = 0; i < levels.length; i++) {
      const { x, y } = points[i];
      const level = levels[i];
      const record = this.records[stageKey(this.view, level.level)];
      const cleared = (record?.clears ?? 0) > 0;
      let fill = 0xeee6d5;
      if (cleared) fill = 0xc9d7b3;
      else if (this.progressLoaded && i === progress.nextIndex) fill = 0xf6c99e;
      this.add.circle(x, y + 5, 43, 0xc2b497);
      const node = this.add.circle(x, y, 43, fill).setStrokeStyle(3, 0x776b50).setInteractive({ useHandCursor: true });
      this.add.text(x, y, String(level.level).padStart(2, '0'), { fontFamily: FONT_FAMILY, fontSize: '30px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
      if (cleared) {
        this.add.circle(x + 30, y + 28, 17, 0x62794e);
        this.add.text(x + 30, y + 28, '✓', { fontFamily: FONT_FAMILY, fontSize: '23px', color: '#fff9e7', fontStyle: 'bold' }).setOrigin(0.5);
      }
      const labelX = i % 2 === 0 ? x + 65 : x - 65;
      const origin = i % 2 === 0 ? 0 : 1;
      this.add.text(labelX, y - 18, level.title, { fontFamily: FONT_FAMILY, fontSize: '25px', color: ink, fontStyle: 'bold' }).setOrigin(origin, 0.5);
      let detail = `${level.shots} 发 · 需要巧劲`;
      if (i < 2) detail = `${level.shots} 发 · 轻松热身`;
      if (i >= levels.length - 2) detail = `${level.shots} 发 · 烧脑挑战`;
      if (cleared) detail = `最佳 ${record.bestScore} 快乐值 · ${record.fewestShots} 发`;
      this.add.text(labelX, y + 18, detail, { fontFamily: FONT_FAMILY, fontSize: '19px', color: '#6d795a' }).setOrigin(origin, 0.5);
      node.on('pointerdown', () => this.showStageBrief(shadow, i));
    }
    let action = `继续第 ${levels[progress.nextIndex].level} 关  →`;
    if (progress.complete) action = '全线盖章！再闯一次  →';
    if (!this.progressLoaded) action = '从第一关开始  →';
    button(this, 360, 1120, 620, action, () => this.startMode(shadow, progress.nextIndex));
    this.add.text(360, 1210, '从第一关连闯，沿途选卡  →', { fontFamily: FONT_FAMILY, fontSize: '23px', color: '#8b6041', padding: { x: 24, y: 14 } }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.startMode(shadow));
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
    panel(this, 80, 770, 560, 175, 0xeaf0df);
    officeProp(this, 145, 855, itemFrames[reward.type], 90);
    const count = cleared ? reward.repeatCount : reward.firstClearCount;
    const coins = cleared ? reward.repeatCoins : reward.firstClearCoins;
    let rewardTitle = cleared ? '再通关，补充工位物资' : '首通奖励 · 带回工位';
    let rewardDetails = `${reward.itemLevel}级${itemNames[reward.type]} ×${count} · ${coins} 币`;
    let rewardBonus = `本关 3 连合，再加 ${reward.comboBonus} 币`;
    if (!this.progressLoaded) {
      rewardTitle = '通关补给 · 首通双份';
      rewardDetails = `${reward.itemLevel}级${itemNames[reward.type]} · 首通2件 / 复通1件`;
      rewardBonus = `首通 ${reward.firstClearCoins} 币 / 复通 ${reward.repeatCoins} 币`;
    }
    this.add.text(210, 791, rewardTitle, { fontFamily: FONT_FAMILY, fontSize: '24px', color: '#547044', fontStyle: 'bold' });
    this.add.text(210, 837, rewardDetails, { fontFamily: FONT_FAMILY, fontSize: '22px', color: ink });
    this.add.text(210, 886, rewardBonus, { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' });
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
