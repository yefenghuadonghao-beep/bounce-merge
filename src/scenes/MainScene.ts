import Phaser from 'phaser';
import { GameController } from '../core/GameController';
import { GameConfig, AfterimageConfig } from '../types';
import { MergeCharge } from '../core/MergeCharge';
import { battlePlanEffects } from '../core/BattlePlan';
import { ShotQueue } from '../core/ShotQueue';
import { AfterimageSystem } from '../core/AfterimageSystem';
import afterimageConfigData from '../config/afterimageConfig.json';
import { button, characterNames, ink, panel, paper, FONT_FAMILY } from '../ui/theme';
import { mergeBurst, paperConfetti } from '../ui/officeEffects';
import { loadOfficeArt, officeProp, officeObstacle } from '../ui/officeArt';
import { setupHiDpi } from '../ui/hidpi';
import { getPlatform } from '../platform';
import { WorkstationManager } from '../core/WorkstationManager';
import type { ItemType } from '../types/workstation';

interface Ball {
  body: MatterJS.BodyType;
  sprite: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  level: number;
  trackId?: number;
  trackStartedAt?: number;
}

interface AfterimagePhysics {
  trackId: number;
  bodies: MatterJS.BodyType[];
  graphics: Phaser.GameObjects.Graphics;
  marker?: Phaser.GameObjects.Image;
}

export class MainScene extends Phaser.Scene {
  private gameController!: GameController;
  private gameConfig!: GameConfig;
  private balls: Ball[] = [];
  private shotQueue!: ShotQueue;
  private launcherPreview!: Phaser.GameObjects.Image;
  private thirdPreview?: Phaser.GameObjects.Image;
  private rotateQueue = false;
  private nextPreview!: Phaser.GameObjects.Image;
  private charge = new MergeCharge();
  private chargeBar?: Phaser.GameObjects.Graphics;
  private comboBar?: Phaser.GameObjects.Graphics;
  private matchRings?: Phaser.GameObjects.Graphics;
  private shakesRemaining = 1;
  private swapsRemaining = 2;
  private shakeLabel!: Phaser.GameObjects.Text;
  private swapLabel!: Phaser.GameObjects.Text;
  private platform = getPlatform();
  private aimLine!: Phaser.GameObjects.Line;
  private aimArrow!: Phaser.GameObjects.Triangle;
  private isAiming: boolean = false;
  private aimAngle: number = 0;
  private uiTexts: { [key: string]: Phaser.GameObjects.Text } = {};
  private canShoot: boolean = true;
  private shotStartedAt = 0;
  private settledSince: number | null = null;
  private awaitingRescue = false;
  private resolving = false;
  private pendingMerges: [Ball, Ball][] = [];
  private scorePopups: Phaser.GameObjects.Text[] = [];
  private comboText!: Phaser.GameObjects.Text;
  private afterimageMode: boolean = false;
  private noAutoTransition: boolean = false;
  private noWinCheck: boolean = false;
  private afterimageSystem?: AfterimageSystem;
  private afterimageConfig?: AfterimageConfig;
  private afterimageGraphics: Map<number, AfterimagePhysics> = new Map();
  private lastMergeCheck = 0;
  private afterimageMergeCount = 0;
  
  // 边界与收纳盒内沿对齐。
  private readonly RAIL_MARGIN = 50;
  // 底部操作区上方是碰撞地板。
  private readonly FLOOR_Y = 1110;

  constructor() {
    super({ key: 'MainScene' });
  }

  init(data: { gameController: GameController; gameConfig: GameConfig; afterimageMode?: boolean }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
    this.afterimageMode = data.afterimageMode ?? false;
    this.balls = [];
    this.charge = new MergeCharge();
    
    // 开发模式：禁用自动转场或完全禁用胜利检测
    if (import.meta.env.DEV) {
      const urlParams = new URLSearchParams(window.location.search);
      const debug = urlParams.get('debug') || '';
      this.noAutoTransition = debug.includes('noauto');
      this.noWinCheck = debug.includes('nowin');
    }
    this.isAiming = false;
    this.canShoot = true;
    this.shotStartedAt = 0;
    this.settledSince = null;
    this.awaitingRescue = false;
    this.resolving = false;
    this.pendingMerges = [];
    this.scorePopups = [];
    this.afterimageGraphics.clear();
    this.lastMergeCheck = 0;
    this.afterimageMergeCount = 0;
    this.afterimageSystem = undefined;
    
    if (this.afterimageMode) {
      this.afterimageConfig = afterimageConfigData as AfterimageConfig;
      this.afterimageSystem = new AfterimageSystem(this.afterimageConfig, {
        onMerge: (track1Id, track2Id, newLevel, x, y, newTrackId) => {
          this.handleAfterimageMerge(track1Id, track2Id, newLevel, x, y, newTrackId);
        },
        onFade: (trackId) => {
          this.removeAfterimagePhysics(trackId);
        }
      });
    }
    
    const state = this.gameController.getGameState();
    const stage = this.gameController.getLevelConfig();
    const target = stage.targetBallLevel ?? 3;
    const base = Math.min(target - 1, Math.max(1, target - 4) + state.startingBallLevel - 1);
    this.shotQueue = new ShotQueue(base, Math.min(target - 1, this.gameController.getMaxBallLevel()), Math.random, stage.shotSequence);
    this.shakesRemaining = stage.shakes ?? 1;
    this.swapsRemaining = stage.swaps ?? 2;
    const plan = battlePlanEffects(state.activePlan, stage);
    this.shakesRemaining += plan.shakes;
    this.swapsRemaining += plan.swaps;
    this.charge = new MergeCharge(plan.chargeThreshold, plan.chargeLimit);
    this.rotateQueue = plan.rotateQueue;
    this.thirdPreview = undefined;
    const upgrades = state.upgrades;
    for (let i = 0, length = upgrades.length; i < length; i++) {
      if (upgrades[i].id === 'extra_shake') this.shakesRemaining += upgrades[i].value;
      if (upgrades[i].id === 'swap_charge') this.swapsRemaining += upgrades[i].value;
    }
  }

  preload() {
    // 帧数据由 scripts/build-character-atlas.mjs 生成：每帧为贴合角色轮廓的正方形，显示尺寸与碰撞圆一致。
    loadOfficeArt(this);
  }

  create() {
    setupHiDpi(this);
    this.matter.world.setBounds(0, 0, this.gameConfig.width, this.gameConfig.height);
    this.matter.world.setGravity(0, this.gameConfig.physics.gravity);

    paper(this);
    this.add.image(360, 640, 'office-room').setDisplaySize(850, 1280).setAlpha(0.25);
    panel(this, 45, 220, 630, 880, 0xfffcf2);
    const binding = this.add.graphics();
    for (let y = 480; y < 1040; y += 80) {
      binding.fillStyle(0xc5b497, 0.5).fillCircle(64, y, 4).fillCircle(656, y, 4);
      binding.lineStyle(2, 0x9d8c6f, 0.6).lineBetween(44, y, 64, y).lineBetween(656, y, 676, y);
    }
    const decor = this.gameController.getLevelConfig().level % 3;
    officeProp(this, 590, 945, decor + 1, 125).setAlpha(0.10);
    officeProp(this, 125, 670, 6, 100).setAlpha(0.08);
    const chapterTitle = this.afterimageMode ? '残影手帐 · 轨迹成路' : '桌面弹珠 · 下班计划';
    this.add.text(82, 246, chapterTitle, { fontFamily: FONT_FAMILY, fontSize: '23px', color: ink, fontStyle: 'bold' });
    const stageTitle = this.afterimageMode ? '残影弹珠' : (this.gameController.getLevelConfig().title ?? '碰一碰就下班');
    this.add.text(360, 800, stageTitle, {
      fontFamily: FONT_FAMILY, fontSize: '34px', color: '#d5cbb9', align: 'center', lineSpacing: 16
    }).setOrigin(0.5);
    const subtitle = this.afterimageMode ? '轨迹变实体 · 同型残影磁吸合并' : '同款相碰升级 · 用完发射前达成目标';
    this.add.text(360, 930, subtitle, { fontFamily: FONT_FAMILY, fontSize: '21px', color: '#c1b49e' }).setOrigin(0.5);
    this.createPegBoard();
    this.createUI();
    this.createAimingLine();
    this.matchRings = this.add.graphics().setDepth(2);
    this.chargeBar = this.add.graphics();
    this.comboBar = this.add.graphics().setDepth(11);
    this.uiTexts.charge = this.add.text(360, 340, '', { fontFamily: FONT_FAMILY, fontSize: '19px', color: ink }).setOrigin(0.5);

    const { startX, startY } = this.gameConfig.launcher;
    this.add.circle(startX, startY, 42, 0xffffff, 0.65).setStrokeStyle(3, 0x49392d);
    this.launcherPreview = this.add.image(startX, startY, 'characters', `ball_${this.shotQueue.peek()[0]}`).setDisplaySize(56, 56);
    panel(this, 24, 1105, 672, 160);
    this.uiTexts.hint = this.add.text(360, 1220, '按住瞄准，松开发射 · 不用等球停下', {
      fontFamily: FONT_FAMILY, fontSize: '23px', color: ink
    }).setOrigin(0.5);
    this.shakeLabel = button(this, 190, 1150, 280, '抱团取暖 ×1', () => this.shakeBoard()).label;
    this.swapLabel = button(this, 530, 1150, 280, '换个搭子 ×2', () => {
      if (this.awaitingRescue) this.finishRescue();
      else this.swapBall();
    }).label;
    const stage = this.gameController.getLevelConfig();
    const presets = stage.presetBalls ?? [];
    for (let i = 0; i < presets.length; i++) {
      const seed = presets[i];
      this.spawnBall(seed.x, seed.y, seed.level);
    }
    const defaultHint = this.afterimageMode ? '按住瞄准发射 · 轨迹变障碍物' : '按住瞄准，松开发射';
    this.uiTexts.hint.setText(stage.hint ?? defaultHint);
    this.updateUI();
    const retry = this.add.text(82, 287, '重试本关', { fontFamily: FONT_FAMILY, fontSize: '20px', color: ink, backgroundColor: '#eee6d5', padding: { x: 8, y: 6 } }).setInteractive({ useHandCursor: true });
    retry.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (this.resolving) return;
      this.resolving = true;
      this.gameController.retryLevel();
      this.scene.restart({ gameController: this.gameController, gameConfig: this.gameConfig, afterimageMode: this.afterimageMode });
    });
    const home = this.add.text(488, 279, '返回首页', { fontFamily: FONT_FAMILY, fontSize: '24px', color: ink, backgroundColor: '#f3bb90', padding: { x: 16, y: 12 } }).setInteractive({ useHandCursor: true });
    home.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (this.resolving) return;
      this.resolving = true;
      this.scene.start('HomeScene', { gameController: this.gameController, gameConfig: this.gameConfig });
    });
    const sound = this.add.text(650, 244, this.platform.isSoundEnabled() ? '音效 开' : '音效 关', {
      fontFamily: FONT_FAMILY, fontSize: '21px', color: ink, backgroundColor: '#fff8ef', padding: { x: 12, y: 10 }
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    sound.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      const enabled = !this.platform.isSoundEnabled();
      this.platform.setSoundEnabled(enabled);
      sound.setText(enabled ? '音效 开' : '音效 关');
    });
    this.setupInput();
    this.setupCollisions();
    
    // 调试：?debug=seed 铺满 1-10 级角色；仅开发构建调用，正式包不会读取 URL。
    if (import.meta.env.DEV) this.checkDebugMode();
  }

  debugFire(angle: number, level?: number) {
    if (!import.meta.env.DEV) return;
    
    // 调试发射：忽略canShoot和resolving，使用提供的level或队列里的下一个
    this.resolving = false;
    const ballLevel = level ?? this.shotQueue.peek()[0] ?? 1;
    const ball = this.spawnBall(this.gameConfig.launcher.startX, this.gameConfig.launcher.startY, ballLevel);
    if (!ball) return;

    const speed = this.gameConfig.launcher.launchForce * 1000;
    this.matter.body.setVelocity(ball.body, {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed
    });
    
    if (this.shotQueue.peek()[0]) {
      if (this.afterimageMode && this.afterimageSystem) {
        this.afterimageSystem.advanceShot();
        ball.trackId = this.afterimageSystem.startTracking(ballLevel);
        ball.trackStartedAt = this.time.now;
        ball.body.collisionFilter.group = -ball.trackId;
      }
      this.shotQueue.take();
      this.gameController.useShot();
    }
    this.updateUI();
    this.settledSince = null;
    
    // 短暂延迟后恢复canShoot，允许连续调试发射
    this.canShoot = false;
    this.time.delayedCall(500, () => {
      this.canShoot = true;
      this.launcherPreview?.setAlpha(1);
    });
  }
  
  private checkDebugMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug');
    
    if (debugMode === 'seed') {
      // Spawn balls of different levels for testing
      this.time.delayedCall(500, () => {
        this.seedDebugBalls();
      });
    }
  }
  
  private seedDebugBalls() {
    if (import.meta.env.DEV) console.log('Debug mode: Seeding balls of levels 1-10');
    
    const positions = [
      { x: 200, y: 400, level: 1 },
      { x: 280, y: 450, level: 2 },
      { x: 360, y: 400, level: 3 },
      { x: 440, y: 450, level: 4 },
      { x: 520, y: 400, level: 5 },
      { x: 250, y: 600, level: 6 },
      { x: 350, y: 600, level: 7 },
      { x: 450, y: 600, level: 8 },
      { x: 300, y: 800, level: 9 },
      { x: 420, y: 800, level: 10 }
    ];
    
    positions.forEach(pos => {
      this.spawnBall(pos.x, pos.y, pos.level);
    });
  }
  
  private spawnBall(x: number, y: number, level: number) {
    const ballConfig = this.gameController.getBallConfig(level);
    if (!ballConfig) return;
    
    const state = this.gameController.getGameState();
    const radius = ballConfig.radius * state.ballSizeMultiplier;
    
    // Use sprite if available, otherwise use procedural circle
    let sprite: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
    const spriteKey = `ball_${level}`;
    
    if (ballConfig.sprite && this.textures.exists('characters')) {
      sprite = this.add.image(x, y, 'characters', spriteKey);
      // 图集单元按碰撞直径显示。
      sprite.setDisplaySize(radius * 2, radius * 2);
    } else {
      sprite = this.add.circle(x, y, radius, ballConfig.color);
    }
    
    this.matter.add.gameObject(sprite, {
      shape: { type: 'circle', radius },
      restitution: this.gameConfig.physics.restitution,
      friction: this.gameConfig.physics.friction,
      frictionAir: this.gameConfig.physics.frictionAir,
      density: this.gameConfig.physics.density,
      label: `ball_${level}`
    });
    
    const body = sprite.body as MatterJS.BodyType;
    const ball: Ball = { body, sprite, level };
    
    this.balls.push(ball);
    return ball;
  }

  private createPegBoard() {
    const obstacles = this.gameController.getLevelConfig().obstacles ?? [];
    for (let i = 0; i < obstacles.length; i++) {
      const obstacle = obstacles[i];
      officeObstacle(this, obstacle);
      if (obstacle.radius) {
        this.matter.add.circle(obstacle.x, obstacle.y, obstacle.radius, { isStatic: true, restitution: 0.65, label: 'peg' });
      } else {
        const width = obstacle.width ?? 100;
        const height = obstacle.height ?? 18;
        const angle = obstacle.angle ?? 0;
        this.matter.add.rectangle(obstacle.x, obstacle.y, width, height, { isStatic: true, angle, restitution: 0.2, friction: 0.005, label: 'floor' });
      }
    }
    officeObstacle(this, { x: 360, y: 1105, width: 620, height: 10, skin: 'notebook' });

    // Physics walls aligned with visual rails
    const wallThickness = 10;
    
    // Left wall at inner edge of left rail
    this.matter.add.rectangle(this.RAIL_MARGIN, this.gameConfig.height / 2, wallThickness, this.gameConfig.height, {
      isStatic: true,
      label: 'wall',
      restitution: 0.8
    });
    
    // Right wall at inner edge of right rail
    this.matter.add.rectangle(this.gameConfig.width - this.RAIL_MARGIN, this.gameConfig.height / 2, wallThickness, this.gameConfig.height, {
      isStatic: true,
      label: 'wall',
      restitution: 0.8
    });
    
    // 地板阻止团子落进操作区。
    this.matter.add.rectangle(this.gameConfig.width / 2, this.FLOOR_Y, this.gameConfig.width, wallThickness * 2, {
      isStatic: true,
      restitution: 0.3,
      label: 'floor'
    });
  }

  private createUI() {
    panel(this, 24, 20, 672, 185);
    this.uiTexts.level = this.add.text(48, 38, '', { fontFamily: FONT_FAMILY, fontSize: '23px', color: ink, fontStyle: 'bold' });
    this.uiTexts.score = this.add.text(666, 38, '', { fontFamily: FONT_FAMILY, fontSize: '22px', color: ink }).setOrigin(1, 0);
    const target = this.gameController.getLevelConfig().targetBallLevel ?? 3;
    this.add.image(79, 114, 'characters', `ball_${target}`).setDisplaySize(64, 64);
    this.uiTexts.goal = this.add.text(126, 86, `合出${characterNames[target]}`, { fontFamily: FONT_FAMILY, fontSize: '27px', color: ink, fontStyle: 'bold' });
    this.uiTexts.progress = this.add.text(126, 130, '', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' });
    this.uiTexts.shots = this.add.text(48, 168, '', { fontFamily: FONT_FAMILY, fontSize: '21px', color: ink });
    this.add.text(606, 78, this.rotateQueue ? '点选换球' : '下一位', { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#8b7c64' }).setOrigin(0.5);
    this.nextPreview = this.add.image(606, 129, 'characters', `ball_${this.shotQueue.peek()[1]}`).setDisplaySize(50, 50);
    if (this.rotateQueue) {
      this.nextPreview.setPosition(566, 129);
      this.thirdPreview = this.add.image(650, 129, 'characters', `ball_${this.shotQueue.at(2)}`).setDisplaySize(50, 50);
      const previews = [this.nextPreview, this.thirdPreview];
      for (let i = 0; i < previews.length; i++) {
        previews[i].setInteractive({ useHandCursor: true });
        previews[i].on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          this.swapBall(i + 1);
        });
      }
    }
    const plan = this.gameController.getGameState().activePlan;
    this.add.text(666, 168, plan ? `本关战术：${plan.name}` : '先熟悉弹道，再选战术', { fontFamily: FONT_FAMILY, fontSize: '19px', color: '#8b6041' }).setOrigin(1, 0);
    this.comboText = this.add.text(360, 404, '', {
      fontFamily: FONT_FAMILY, fontSize: '42px', color: '#fff7cd', fontStyle: 'bold', stroke: '#785d42', strokeThickness: 5
    }).setOrigin(0.5).setDepth(10).setVisible(false);
  }

  private updateUI() {
    const state = this.gameController.getGameState();
    this.uiTexts.level.setText(`${state.currentLevel}/${this.gameController.getLevelCount()} · ${this.gameController.getLevelConfig().title ?? "下班团子"}`);
    this.uiTexts.score.setText(`快乐值 ${state.score}`);
    this.uiTexts.shots.setText(`还有 ${state.shotsRemaining} 球`);
    this.uiTexts.progress.setText(state.highestBallLevel === 1 ? '同款相碰 → 升一级' : `本关合成：${characterNames[state.highestBallLevel]}`);
    if (this.afterimageMode) {
      const requiredMerges = this.gameController.getLevelConfig().requiredAfterimageMerges ?? 1;
      this.uiTexts.progress.setText(`残影共鸣 ${Math.min(requiredMerges, this.afterimageMergeCount)}/${requiredMerges} · 最高 ${characterNames[state.highestBallLevel]}`);
    }
    let shakeName = this.afterimageMode ? '清影抱团' : '抱团取暖';
    if (this.awaitingRescue) shakeName = '抱团救场';
    this.shakeLabel?.setText(`${shakeName} ×${this.shakesRemaining}`);
    const swapName = this.rotateQueue ? '轮换三球' : '换个搭子';
    let swapText = `${swapName} ×${this.swapsRemaining}`;
    if (state.shotsRemaining === 0) swapText = '等待停稳';
    if (this.awaitingRescue) swapText = '结束本关';
    this.swapLabel?.setText(swapText);
    this.shakeLabel?.parentContainer?.setAlpha(this.shakesRemaining > 0 ? 1 : 0.45);
    const canSwapOrFinish = this.awaitingRescue || (state.shotsRemaining > 0 && this.swapsRemaining > 0);
    this.swapLabel?.parentContainer?.setAlpha(canSwapOrFinish ? 1 : 0.45);
    if (this.uiTexts.charge) {
      const full = this.charge.rewards >= this.charge.limit;
      this.uiTexts.charge.setText(full ? '本关充能奖励已领满' : `充能 ${this.charge.charge}/${this.charge.threshold} · 3 连合双倍 · 奖励 ${this.charge.rewards}/${this.charge.limit}`);
      this.chargeBar?.clear().fillStyle(0xe6decd).fillRoundedRect(180, 360, 360, 8, 4);
      const progress = full ? 1 : this.charge.charge / this.charge.threshold;
      if (progress > 0) this.chargeBar?.fillStyle(0xee976e).fillRoundedRect(180, 360, 360 * progress, 8, 4);
    }
    const queue = this.shotQueue.peek();
    this.launcherPreview?.setTexture('characters', `ball_${queue[0]}`).setDisplaySize(56, 56);
    this.nextPreview.setTexture('characters', `ball_${queue[1]}`).setDisplaySize(50, 50);
    this.thirdPreview?.setTexture('characters', `ball_${queue[2]}`);
    if (state.combo > 1) {
      this.comboText.setText(`${state.combo} 连合！继续碰！`).setVisible(true);
      this.tweens.killTweensOf(this.comboText);
      this.tweens.add({ targets: this.comboText, scale: { from: 1.25, to: 1 }, duration: 180 });
    }
  }

  private swapBall(slot?: number) {
    if (this.resolving || this.swapsRemaining <= 0 || !this.canShoot) return;
    const samePair = this.shotQueue.at(0) === this.shotQueue.at(1);
    const sameQueue = samePair && (!this.rotateQueue || this.shotQueue.at(0) === this.shotQueue.at(2));
    if (slot !== undefined && !this.rotateQueue) return;
    const sameSelected = slot !== undefined && this.shotQueue.at(0) === this.shotQueue.at(slot);
    if (sameQueue || sameSelected) {
      this.uiTexts.hint.setText('可换的都是同款，留着机会给下一次吧');
      return;
    }
    if (slot !== undefined) this.shotQueue.swap(slot);
    else if (this.rotateQueue) this.shotQueue.rotate();
    else this.shotQueue.swap();
    this.swapsRemaining--;
    this.updateUI();
    this.platform.playSound('swap');
  }

  private shakeBoard() {
    if (this.resolving || this.shakesRemaining <= 0 || this.balls.length === 0) return;
    this.shakesRemaining--;
    const plan = battlePlanEffects(this.gameController.getGameState().activePlan, this.gameController.getLevelConfig());
    this.afterimageSystem?.clearSettledTracks(plan.preserveCores);
    const balls = this.balls;
    for (let i = 0, length = balls.length; i < length; i++) {
      const body = balls[i].body;
      (balls[i].sprite as Phaser.GameObjects.Image & Phaser.Physics.Matter.Components.Sleep).setAwake();
      this.matter.body.setVelocity(body, { x: (360 - body.position.x) * 0.025, y: -7 });
    }
    this.shotStartedAt = this.time.now;
    this.settledSince = null;
    this.awaitingRescue = false;
    this.cameras.main.shake(180, 0.006);
    this.platform.playSound('swap');
    this.updateUI();
  }

  private createAimingLine() {
    this.aimLine = this.add.line(0, 0, 0, 0, 0, 0, 0x75614c, 0.8);
    this.aimLine.setOrigin(0);
    this.aimLine.setLineWidth(3);
    this.aimLine.setVisible(false);

    this.aimArrow = this.add.triangle(0, 0, 0, 10, 10, 0, 0, -10, 0xfeca57);
    this.aimArrow.setVisible(false);
  }

  private setupInput() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.worldY < 210 || pointer.worldY > 1100) return;
      if (this.canShoot && !this.resolving && this.gameController.getGameState().shotsRemaining > 0) {
        this.isAiming = true;
        this.updateAim(pointer);
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isAiming) {
        this.updateAim(pointer);
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.isAiming) return;
      if (pointer.worldY < 210 || pointer.worldY > 1100) {
        this.isAiming = false;
        this.aimLine.setVisible(false);
        this.aimArrow.setVisible(false);
        return;
      }
      this.launchBall();
    });
    this.input.on('gameout', () => {
      this.isAiming = false;
      this.aimLine.setVisible(false);
      this.aimArrow.setVisible(false);
    });
  }

  private updateAim(pointer: Phaser.Input.Pointer) {
    const startX = this.gameConfig.launcher.startX;
    const startY = this.gameConfig.launcher.startY;
    
    // 只允许向下发射，避免球飞进顶部 HUD。
    this.aimAngle = Phaser.Math.Clamp(Math.atan2(Math.max(1, pointer.worldY - startY), pointer.worldX - startX), 0.2, Math.PI - 0.2);
    
    const endX = startX + Math.cos(this.aimAngle) * this.gameConfig.launcher.aimLineLength;
    const endY = startY + Math.sin(this.aimAngle) * this.gameConfig.launcher.aimLineLength;

    this.aimLine.setTo(startX, startY, endX, endY);
    this.aimLine.setVisible(true);

    this.aimArrow.setPosition(endX, endY);
    this.aimArrow.setRotation(this.aimAngle + Math.PI / 2);
    this.aimArrow.setVisible(true);
  }

  private launchBall() {
    this.isAiming = false;
    this.aimLine.setVisible(false);
    this.aimArrow.setVisible(false);

    const state = this.gameController.getGameState();
    if (!this.canShoot || this.resolving || state.shotsRemaining <= 0) return;

    const level = this.shotQueue.peek()[0];
    const ball = this.spawnBall(this.gameConfig.launcher.startX, this.gameConfig.launcher.startY, level);
    if (!ball) return;

    // Matter 的速度以每帧像素计，避免高速穿透钉子和边界。
    const speed = this.gameConfig.launcher.launchForce * 1000;
    this.matter.body.setVelocity(ball.body, {
      x: Math.cos(this.aimAngle) * speed,
      y: Math.sin(this.aimAngle) * speed
    });
    if (this.afterimageMode && this.afterimageSystem) {
      this.afterimageSystem.advanceShot();
      ball.trackId = this.afterimageSystem.startTracking(level);
      ball.trackStartedAt = this.time.now;
      ball.body.collisionFilter.group = -ball.trackId;
    }
    this.shotQueue.take();
    this.gameController.useShot();
    this.platform.playSound('shot');
    this.updateUI();
    this.canShoot = false;
    this.launcherPreview.setAlpha(0.35);
    this.uiTexts.hint?.setText('找准同款团子，下一位马上就好');
    this.shotStartedAt = this.time.now;
    this.settledSince = null;
  }

  private setupCollisions() {
    const onCollision = (event: { pairs: { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[] }) => {
      const pairs = event.pairs;
      for (let i = 0, length = pairs.length; i < length; i++) {
        const { bodyA, bodyB } = pairs[i];
        const ballA = this.balls.find(ball => ball.body === bodyA);
        const ballB = this.balls.find(ball => ball.body === bodyB);
        if (ballA && ballB && this.gameController.canMerge(ballA.level, ballB.level)) {
          this.pendingMerges.push([ballA, ballB]);
        }
        if ((ballA && bodyB.label === 'wall') || (ballB && bodyA.label === 'wall')) {
          if (this.gameController.processWallBounce() > 0) this.updateUI();
        }
      }
    };
    const world = this.matter.world;
    world.on('collisionstart', onCollision);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // Matter 插件先清空 world 引用，清理时使用本次场景捕获的实例。
      world.off('collisionstart', onCollision);
    });
  }

  private mergeBalls(ball1: Ball, ball2: Ball) {
    const midX = (ball1.sprite.x + ball2.sprite.x) / 2;
    const midY = (ball1.sprite.y + ball2.sprite.y) / 2;

    const result = this.gameController.processMerge(ball1.level, this.time.now);
    const newLevel = result.newLevel;
    const score = result.score;
    
    const newConfig = this.gameController.getBallConfig(newLevel);
    if (!newConfig) return;

    const state = this.gameController.getGameState();

    this.createMergeEffect(midX, midY, newConfig.color);
    this.showScorePopup(midX, midY, score, newLevel);
    this.cameras.main.shake(80, Math.min(0.007, 0.0015 * state.combo));
    this.platform.playSound(`merge_${newLevel}_${state.combo}`);
    if (this.charge.add(state.combo)) {
      this.shakesRemaining++;
      const refunded = this.refundPlanSwap();
      const rewardText = refunded ? '抱团 +1 · 换球返还 +1' : '充满了！抱团取暖 +1';
      const reward = this.add.text(360, 460, rewardText, {
        fontFamily: FONT_FAMILY, fontSize: '30px', color: '#547044', backgroundColor: '#fff9e7', padding: { x: 16, y: 10 }
      }).setOrigin(0.5).setDepth(15);
      this.tweens.add({ targets: reward, y: 420, alpha: 0, delay: 850, duration: 450, onComplete: () => reward.destroy() });
    }

    this.removeBall(ball1);
    this.removeBall(ball2);

    const merged = this.spawnBall(midX, midY, newLevel);
    // 弹性动画只作用于独立外观，避免缩放物理碰撞体。
    if (merged) {
      const diameter = (this.gameController.getBallConfig(newLevel)?.radius ?? 32) * state.ballSizeMultiplier * 2;
      merged.sprite.setAlpha(0);
      const echo = this.add.image(midX, midY, 'characters', `ball_${newLevel}`).setDisplaySize(diameter * 1.4, diameter * 0.75).setDepth(5);
      this.tweens.add({ targets: echo, displayWidth: diameter, displayHeight: diameter, duration: 320, ease: 'Back.Out',
        onUpdate: () => { if (merged.sprite.active) echo.setPosition(merged.sprite.x, merged.sprite.y); },
        onComplete: () => { if (merged.sprite.active) merged.sprite.setAlpha(1); echo.destroy(); }
      });
    }
    this.settledSince = null;

    this.updateUI();
  }

  private refundPlanSwap() {
    const plan = battlePlanEffects(this.gameController.getGameState().activePlan, this.gameController.getLevelConfig());
    const refund = plan.refundSwapOnCharge && this.charge.rewards === 1;
    if (refund) this.swapsRemaining++;
    return refund;
  }

  private removeBall(ball: Ball) {
    this.finalizeBallTrack(ball);
    const index = this.balls.indexOf(ball);
    if (index > -1) {
      this.balls.splice(index, 1);
    }

    this.matter.world.remove(ball.body);
    ball.sprite.destroy();
  }

  private createMergeEffect(x: number, y: number, color: number) {
    mergeBurst(this, x, y, color, this.gameController.getGameState().combo, this.afterimageMode);
  }

  private showScorePopup(x: number, y: number, score: number, level: number) {
    const lines = ['', '', '脑子放空了', '我没事，真的', '咖啡续命！', '卡打了，人走了', '正在加载灵魂', '摸鱼使我快乐', '躺平也很可爱', '先溜为敬！', '准点下班！'];
    while (this.scorePopups.length >= 3) {
      const old = this.scorePopups.shift()!;
      this.tweens.killTweensOf(old);
      old.destroy();
    }
    const popupY = Math.min(1000, Math.max(500, y));
    const text = this.add.text(Phaser.Math.Clamp(x, 150, 570), popupY, `${lines[level]}\n+${score}`, {
      fontFamily: FONT_FAMILY, fontSize: '24px',
      color: '#49392d',
      align: 'center', stroke: '#fff9e7', strokeThickness: 5,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(12);

    this.scorePopups.push(text);

    this.tweens.add({
      targets: text,
      y: popupY - 50,
      alpha: 0,
      duration: 1000,
      onComplete: () => {
        const index = this.scorePopups.indexOf(text);
        if (index > -1) this.scorePopups.splice(index, 1);
        text.destroy();
      }
    });
  }

  private victoryOverlay?: Phaser.GameObjects.Container;
  
  private async awardWorkstationItems() {
    try {
      const manager = WorkstationManager.getInstance(this.platform);
      const current = this.gameController.getGameState();
      const level = this.gameController.getLevelConfig();
      
      // Calculate performance: better scores = more/better items
      const scoreRatio = current.score / (level.targetScore || 100);
      const itemCount = scoreRatio >= 1.5 ? 3 : scoreRatio >= 1.0 ? 2 : 1;
      
      const itemTypes: ItemType[] = ['document', 'coffee', 'package', 'keyboard', 'mouse', 'plant'];
      const items: { type: ItemType; level: number }[] = [];
      
      for (let i = 0; i < itemCount; i++) {
        const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        const level = Math.floor(Math.random() * 3) + 1; // Lv 1-3
        items.push({ type, level });
      }
      
      await manager.addRewardItems(items);
    } catch (e) {
      console.warn('Failed to award workstation items:', e);
    }
  }

  private showVictory() {
    // 开发模式下可完全禁用胜利overlay
    if (import.meta.env.DEV) {
      const debug = new URLSearchParams(window.location.search).get('debug');
      if (debug?.includes('nooverlay')) {
        return;
      }
    }
    
    // 清理旧的overlay避免重复
    if (this.victoryOverlay) {
      this.victoryOverlay.destroy();
    }
    const state = this.gameController.getGameState();
    const target = this.gameController.getLevelConfig().targetBallLevel ?? state.highestBallLevel;
    const shade = this.add.rectangle(360, 660, 620, 870, 0xfff9eb, 0.96);
    const ticket = this.add.graphics();
    ticket.fillStyle(0xf1e5cd).fillRoundedRect(106, 355, 508, 580, 28);
    ticket.lineStyle(2, 0xc7b38f).strokeRoundedRect(106, 355, 508, 580, 28);
    ticket.lineStyle(2, 0xd1bd98);
    for (let x = 128; x < 590; x += 20) ticket.lineBetween(x, 858, x + 10, 858);
    const title = this.add.text(360, 412, '坏情绪，碰掉了！', { fontFamily: FONT_FAMILY, fontSize: '38px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
    const hero = this.add.image(360, 596, 'characters', `ball_${target}`).setDisplaySize(180, 180);
    const stage = this.gameController.getLevelConfig();
    const summary = this.gameController.getRunSummary();
    const stamp = this.add.text(514, 720, '准点\n下班', { fontFamily: FONT_FAMILY, fontSize: '27px', color: '#af6549', align: 'center', backgroundColor: '#fff3db', padding: { x: 12, y: 8 } }).setOrigin(0.5).setAngle(-12);
    const subtitle = this.add.text(360, 750, `${characterNames[target]} 到岗
最高 ${summary.bestCombo} 连合 · 合成 ${summary.merges} 次`, { fontFamily: FONT_FAMILY, fontSize: '25px', color: ink, align: 'center', lineSpacing: 12 }).setOrigin(0.5);
    const footer = this.add.text(360, 893, stage.chapterEnd ? '全员到齐，今天到此为止' : '带着好心情，选下一关战术', { fontFamily: FONT_FAMILY, fontSize: '21px', color: '#8b7c64' }).setOrigin(0.5);
    const root = this.add.container(0, 0, [shade, ticket, title, hero, subtitle, stamp, footer]).setDepth(30);
    this.victoryOverlay = root;
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 200 });
    hero.setDisplaySize(90, 90);
    this.tweens.add({ targets: hero, displayWidth: 180, displayHeight: 180, duration: 500, ease: 'Back.Out' });
    this.tweens.add({ targets: hero, y: 578, delay: 500, duration: 550, yoyo: true, ease: 'Sine.easeInOut' });
    stamp.setScale(2.4).setAlpha(0);
    this.tweens.add({ targets: stamp, scaleX: 1, scaleY: 1, alpha: 1, delay: 450, duration: 230, ease: 'Cubic.easeIn' });
    paperConfetti(this, root);
  }

  update(time: number) {
    if (this.resolving) return;
    this.gameController.updateCombo(time);
    const state = this.gameController.getGameState();
    this.comboBar?.clear();
    if (state.combo > 1 && !this.resolving) {
      const remaining = Math.max(0, 1 - (time - state.comboTimer) / this.gameConfig.scoring.comboDecayTime);
      this.comboBar?.fillStyle(0xee976e).fillRect(240, 436, 240 * remaining, 5);
    }
    
    if (this.afterimageMode && !this.resolving) {
      this.updateAfterimages();
      
      if (this.afterimageSystem && this.afterimageConfig && time - this.lastMergeCheck > this.afterimageConfig.mergeCheckInterval) {
        this.lastMergeCheck = time;
        this.checkAfterimageGlobalMerges();
      }
    }
    
    this.matchRings?.clear();
    if (this.isAiming) {
      const next = this.shotQueue.at(0);
      const ringRadius = (this.gameController.getBallConfig(next)?.radius ?? 26) * state.ballSizeMultiplier + 7;
      const shadows = Array.from(this.afterimageGraphics.values());
      for (let i = 0; i < shadows.length; i++) {
        const shadow = shadows[i];
        const track = this.afterimageSystem?.getTrack(shadow.trackId);
        if (track?.ballLevel !== next || !shadow.marker) continue;
        this.matchRings?.lineStyle(3, 0xd89458, 0.8).strokeCircle(shadow.marker.x, shadow.marker.y, 34);
      }
      for (let i = 0, length = this.balls.length; i < length; i++) {
        const ball = this.balls[i];
        if (ball.level !== next) continue;
        this.matchRings?.lineStyle(3, 0xd89458, 0.8).strokeCircle(ball.sprite.x, ball.sprite.y, ringRadius);
      }
    }

    if (state.combo === 0 && this.comboText.visible) {
      this.comboText.setVisible(false);
    }

    // 在物理步结束后处理合成，同一颗球只能参与一次。
    const merges = this.pendingMerges.splice(0);
    for (let i = 0, length = merges.length; i < length; i++) {
      const [first, second] = merges[i];
      if (this.balls.includes(first) && this.balls.includes(second)) this.mergeBalls(first, second);
    }
    if (this.resolving) return;
    
    // 开发模式下可完全禁用胜利检测
    if (this.noWinCheck) return;
    
    const current = this.gameController.getGameState();
    const status = this.gameController.checkLevelComplete();
    if (status === 'win' && (!this.afterimageMode || this.afterimageMergeCount >= (this.gameController.getLevelConfig().requiredAfterimageMerges ?? 1))) {
      this.resolving = true;
      this.canShoot = false;
      this.isAiming = false;
      this.aimLine?.setVisible(false);
      this.aimArrow?.setVisible(false);
      this.uiTexts.hint?.setText('过关了！挑选下一关的战术');
      this.showVictory();
      
      // Award workstation items
      this.awardWorkstationItems();
      
      // 开发模式下可禁用自动转场
      if (!this.noAutoTransition) {
        this.time.delayedCall(2200, () => {
          const destination = this.gameController.getLevelConfig().chapterEnd ? 'GameOverScene' : 'UpgradeScene';
          this.scene.start(destination, { gameController: this.gameController, gameConfig: this.gameConfig, won: true, afterimageMode: this.afterimageMode, afterimageMerges: this.afterimageMergeCount });
        });
      }
      return;
    }

    // 发射冷却独立于场上运动，让玩家能主动追击制造连锁。
    if (current.shotsRemaining > 0) {
      if (!this.canShoot && time - this.shotStartedAt >= 450) {
        this.canShoot = true;
        this.launcherPreview?.setAlpha(1);
        this.uiTexts.hint?.setText(this.gameController.getLevelConfig().hint ?? '按住瞄准，松开发射 · 可以连续追击');
      }
      return;
    }
    this.canShoot = false;
    this.launcherPreview?.setVisible(false);
    const hint = this.shakesRemaining > 0 ? '等待团子停稳 · 还可以抱团救场' : '最后一球结算中…';
    this.uiTexts.hint?.setText(hint);
    const moving = this.balls.some(ball => !ball.body.isSleeping && Math.hypot(ball.body.velocity.x, ball.body.velocity.y) > 0.3);
    if (moving || time - this.shotStartedAt < (this.afterimageMode ? 1900 : 1000)) {
      this.settledSince = null;
      if (this.awaitingRescue) {
        this.awaitingRescue = false;
        this.updateUI();
      }
      return;
    }
    if (this.settledSince === null) this.settledSince = time;
    if (time - this.settledSince < 700) return;

    // 有资源就把决定权留给玩家；抱团后重新等待物理结果。
    if (this.shakesRemaining > 0 && this.balls.length > 0) {
      if (!this.awaitingRescue) {
        this.awaitingRescue = true;
        this.updateUI();
      }
      this.uiTexts.hint?.setText(`还剩 ${this.shakesRemaining} 次抱团 · 想好再用，或结束本关`);
      return;
    }
    this.finishFailure();
  }

  private finishRescue() {
    if (!this.awaitingRescue || this.resolving) return;
    if (this.pendingMerges.length > 0 || this.balls.some(ball => !ball.body.isSleeping && Math.hypot(ball.body.velocity.x, ball.body.velocity.y) > 0.3)) return;
    this.finishFailure();
  }

  private finishFailure() {
    if (this.resolving) return;
    this.resolving = true;
    this.awaitingRescue = false;
    this.scene.start('GameOverScene', { gameController: this.gameController, gameConfig: this.gameConfig, won: false, afterimageMode: this.afterimageMode, afterimageMerges: this.afterimageMergeCount });
  }

  // 只有发射的团子留影，顶部发射区和底部收纳区保持畅通。
  private trackBallMovement(ball: Ball) {
    if (!this.afterimageSystem || ball.trackId === undefined) return;
    if (ball.sprite.y < 520 || ball.sprite.y > 1000) return;
    this.afterimageSystem.addSegment(ball.trackId, ball.sprite.x, ball.sprite.y, this.time.now);
    if (!this.afterimageGraphics.has(ball.trackId)) {
      this.afterimageGraphics.set(ball.trackId, { trackId: ball.trackId, bodies: [], graphics: this.add.graphics().setDepth(3) });
    }
  }

  private finalizeBallTrack(ball: Ball) {
    if (!this.afterimageSystem || ball.trackId === undefined) return;
    if (this.afterimageSystem.finalizeTrack(ball.trackId)) this.createAfterimagePhysics(ball.trackId);
    ball.trackId = undefined;
  }

  private createAfterimagePhysics(trackId: number) {
    const track = this.afterimageSystem?.getTrack(trackId);
    if (!track || !this.afterimageConfig || track.segments.length === 0) return;
    this.removeAfterimagePhysics(trackId);
    const graphics = this.add.graphics().setDepth(3);
    const bodies: MatterJS.BodyType[] = [];
    const options = { isStatic: true, restitution: 0.6, label: `afterimage_${trackId}`, collisionFilter: { group: -trackId } };
    for (let i = 0; i < track.segments.length - 1; i++) {
      const a = track.segments[i];
      const b = track.segments[i + 1];
      bodies.push(this.matter.add.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2,
        Math.hypot(b.x - a.x, b.y - a.y), this.afterimageConfig.segmentThickness,
        { ...options, angle: Math.atan2(b.y - a.y, b.x - a.x) }));
    }
    const anchor = track.segments[Math.floor(track.segments.length / 2)];
    const diameter = track.segments.length === 1 ? 48 : 30;
    if (track.segments.length === 1) bodies.push(this.matter.add.circle(anchor.x, anchor.y, 18, options));
    const marker = this.add.image(anchor.x, anchor.y, 'characters', `ball_${track.ballLevel}`).setDisplaySize(diameter, diameter).setDepth(4);
    this.afterimageGraphics.set(trackId, { trackId, bodies, graphics, marker });
    this.renderAfterimage(trackId);
  }

  private renderAfterimage(trackId: number) {
    const physics = this.afterimageGraphics.get(trackId);
    const track = this.afterimageSystem?.getTrack(trackId);
    if (!physics || !track || !this.afterimageConfig) return;
    const color = this.gameController.getBallConfig(track.ballLevel)?.color ?? 0xee976e;
    const width = track.finalized ? this.afterimageConfig.segmentThickness : 3;
    physics.graphics.clear().lineStyle(width, color, track.opacity);
    for (let i = 0; i < track.segments.length - 1; i++) {
      const a = track.segments[i];
      const b = track.segments[i + 1];
      physics.graphics.lineBetween(a.x, a.y, b.x, b.y);
    }
    if (physics.marker) {
      physics.marker.setAlpha(Math.min(1, track.opacity + 0.3));
      physics.graphics.lineStyle(2, color, track.opacity).strokeCircle(physics.marker.x, physics.marker.y, 25);
    }
  }

  private removeAfterimagePhysics(trackId: number) {
    const physics = this.afterimageGraphics.get(trackId);
    if (!physics) return;
    for (let i = 0; i < physics.bodies.length; i++) this.matter.world.remove(physics.bodies[i]);
    physics.graphics.destroy();
    physics.marker?.destroy();
    this.afterimageGraphics.delete(trackId);
  }

  private handleAfterimageMerge(track1Id: number, track2Id: number, newLevel: number, x: number, y: number, newTrackId: number) {
    // 旧残影向交汇点收拢，新核心立即显示并能继续共鸣。
    const ids = [track1Id, track2Id];
    for (let i = 0; i < ids.length; i++) {
      const marker = this.afterimageGraphics.get(ids[i])?.marker;
      if (marker) {
        const echo = this.add.image(marker.x, marker.y, 'characters', `ball_${newLevel - 1}`).setDisplaySize(36, 36).setDepth(8);
        this.tweens.add({ targets: echo, x, y, alpha: 0, duration: 220, onComplete: () => echo.destroy() });
      }
      this.removeAfterimagePhysics(ids[i]);
    }
    this.createAfterimagePhysics(newTrackId);
    this.afterimageMergeCount++;
    const result = this.gameController.processMerge(newLevel - 1, this.time.now);
    const combo = this.gameController.getGameState().combo;
    const charged = this.charge.add(combo);
    let refunded = false;
    if (charged) {
      this.shakesRemaining++;
      refunded = this.refundPlanSwap();
    }
    this.showScorePopup(x, y, result.score, newLevel);
    this.createMergeEffect(x, y, this.gameController.getBallConfig(newLevel)?.color ?? 0xffffff);
    this.cameras.main.shake(100, Math.min(0.007, 0.002 * combo));
    this.platform.playSound(`merge_${newLevel}_${combo}`);
    let feedback = `残影共鸣！${characterNames[newLevel]}留下来了`;
    if (charged) feedback = '充能满了！清影抱团 +1';
    if (refunded) feedback = '充能完成！抱团 +1 · 换球返还 +1';
    this.uiTexts.hint?.setText(feedback);
    this.settledSince = null;
    this.updateUI();
  }

  private checkAfterimageGlobalMerges() {
    if (!this.afterimageSystem) return;
    const merges = this.afterimageSystem.checkMerges();
    for (let i = 0; i < merges.length; i++) {
      const merge = merges[i];
      this.afterimageSystem.processMerge(merge.track1Id, merge.track2Id, merge.newLevel, merge.x, merge.y);
    }
  }

  private updateAfterimages() {
    if (!this.afterimageSystem) return;
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      if (ball.trackId === undefined) continue;
      this.trackBallMovement(ball);
      const stopped = ball.body.isSleeping || Math.hypot(ball.body.velocity.x, ball.body.velocity.y) <= 0.5;
      if (stopped || this.time.now - (ball.trackStartedAt ?? this.time.now) >= 1500) this.finalizeBallTrack(ball);
    }
    const ids = Array.from(this.afterimageGraphics.keys());
    for (let i = 0; i < ids.length; i++) this.renderAfterimage(ids[i]);
  }
}
