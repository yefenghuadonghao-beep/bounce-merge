import Phaser from 'phaser';
import { GameController } from '../core/GameController';
import { GameConfig } from '../types';
import { MergeCharge } from '../core/MergeCharge';
import { ShotQueue } from '../core/ShotQueue';
import { assetUrl } from '../platform/assets';
import characterAtlas from '../config/characterAtlas.json';
import { button, characterNames, ink, panel, paper } from '../ui/theme';
import { getPlatform } from '../platform';

interface Ball {
  body: MatterJS.BodyType;
  sprite: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  level: number;
}

export class MainScene extends Phaser.Scene {
  private gameController!: GameController;
  private gameConfig!: GameConfig;
  private balls: Ball[] = [];
  private shotQueue!: ShotQueue;
  private launcherPreview!: Phaser.GameObjects.Image;
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
  private resolving = false;
  private pendingMerges: [Ball, Ball][] = [];
  private scorePopups: Phaser.GameObjects.Text[] = [];
  private comboText!: Phaser.GameObjects.Text;
  
  // 边界与收纳盒内沿对齐。
  private readonly RAIL_MARGIN = 50;
  // 底部操作区上方是碰撞地板。
  private readonly FLOOR_Y = 1110;

  constructor() {
    super({ key: 'MainScene' });
  }

  init(data: { gameController: GameController; gameConfig: GameConfig }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
    this.balls = [];
    this.charge = new MergeCharge();
    this.isAiming = false;
    this.canShoot = true;
    this.shotStartedAt = 0;
    this.settledSince = null;
    this.resolving = false;
    this.pendingMerges = [];
    this.scorePopups = [];
    const state = this.gameController.getGameState();
    const stage = this.gameController.getLevelConfig();
    const target = stage.targetBallLevel ?? 3;
    const base = Math.min(target - 1, Math.max(1, target - 4) + state.startingBallLevel - 1);
    this.shotQueue = new ShotQueue(base, Math.min(target - 1, this.gameController.getMaxBallLevel()), Math.random, stage.shotSequence);
    this.shakesRemaining = stage.shakes ?? 1;
    this.swapsRemaining = stage.swaps ?? 2;
    const upgrades = state.upgrades;
    for (let i = 0, length = upgrades.length; i < length; i++) {
      if (upgrades[i].id === 'extra_shake') this.shakesRemaining += upgrades[i].value;
      if (upgrades[i].id === 'swap_charge') this.swapsRemaining += upgrades[i].value;
    }
  }

  preload() {
    // 帧数据由 scripts/build-character-atlas.mjs 生成：每帧为贴合角色轮廓的正方形，显示尺寸与碰撞圆一致。
    this.load.atlas('characters', assetUrl('assets/characters/office-mochi.png'), characterAtlas);
  }

  create() {
    this.matter.world.setBounds(0, 0, this.gameConfig.width, this.gameConfig.height);
    this.matter.world.setGravity(0, this.gameConfig.physics.gravity);

    paper(this);
    panel(this, 45, 220, 630, 880, 0xfffcf2);
    this.add.text(82, 246, '第一章 · 打工日常', { fontSize: '23px', color: ink, fontStyle: 'bold' });
    this.add.text(360, 800, this.gameController.getLevelConfig().title ?? '碰一碰就下班', {
      fontSize: '34px', color: '#d5cbb9', align: 'center', lineSpacing: 16
    }).setOrigin(0.5);
    this.add.text(360, 930, '同款相碰升级 · 用完发射前达成目标', { fontSize: '21px', color: '#c1b49e' }).setOrigin(0.5);
    this.createPegBoard();
    this.createUI();
    this.createAimingLine();
    this.matchRings = this.add.graphics().setDepth(2);
    this.chargeBar = this.add.graphics();
    this.comboBar = this.add.graphics().setDepth(11);
    this.uiTexts.charge = this.add.text(360, 340, '', { fontSize: '19px', color: ink }).setOrigin(0.5);

    const { startX, startY } = this.gameConfig.launcher;
    this.add.circle(startX, startY, 42, 0xffffff, 0.65).setStrokeStyle(3, 0x49392d);
    this.launcherPreview = this.add.image(startX, startY, 'characters', `ball_${this.shotQueue.peek()[0]}`).setDisplaySize(56, 56);
    panel(this, 24, 1105, 672, 160);
    this.uiTexts.hint = this.add.text(360, 1220, '按住瞄准，松开发射 · 不用等球停下', {
      fontSize: '23px', color: ink
    }).setOrigin(0.5);
    this.shakeLabel = button(this, 190, 1150, 280, '抱团取暖 ×1', () => this.shakeBoard()).label;
    this.swapLabel = button(this, 530, 1150, 280, '换个搭子 ×2', () => this.swapBall()).label;
    const stage = this.gameController.getLevelConfig();
    const presets = stage.presetBalls ?? [];
    for (let i = 0; i < presets.length; i++) {
      const seed = presets[i];
      this.spawnBall(seed.x, seed.y, seed.level);
    }
    this.uiTexts.hint.setText(stage.hint ?? '按住瞄准，松开发射');
    this.updateUI();
    const retry = this.add.text(82, 287, '重试本关', { fontSize: '20px', color: ink, backgroundColor: '#eee6d5', padding: { x: 8, y: 6 } }).setInteractive({ useHandCursor: true });
    retry.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      if (this.resolving) return;
      this.resolving = true;
      this.gameController.retryLevel();
      this.scene.restart({ gameController: this.gameController, gameConfig: this.gameConfig });
    });
    const sound = this.add.text(650, 244, this.platform.isSoundEnabled() ? '音效 开' : '音效 关', {
      fontSize: '21px', color: ink, backgroundColor: '#fff8ef', padding: { x: 12, y: 10 }
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
    console.log('Debug mode: Seeding balls of levels 1-10');
    
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
      if (obstacle.radius) {
        const peg = this.add.circle(obstacle.x, obstacle.y, obstacle.radius, 0xe9be69).setStrokeStyle(3, 0x49392d);
        this.matter.add.gameObject(peg, { isStatic: true, shape: { type: 'circle', radius: obstacle.radius }, restitution: 0.65, label: 'peg' });
      } else {
        const width = obstacle.width ?? 100;
        const height = obstacle.height ?? 18;
        const angle = obstacle.angle ?? 0;
        this.add.rectangle(obstacle.x, obstacle.y, width, height, 0xb9c9a1).setRotation(angle).setStrokeStyle(3, 0x49392d);
        this.matter.add.rectangle(obstacle.x, obstacle.y, width, height, { isStatic: true, angle, restitution: 0.2, friction: 0.005, label: 'floor' });
      }
    }
    this.add.rectangle(360, 1105, 620, 10, 0xb9c9a1).setStrokeStyle(2, 0x49392d);

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
    this.uiTexts.level = this.add.text(48, 38, '', { fontSize: '23px', color: ink, fontStyle: 'bold' });
    this.uiTexts.score = this.add.text(666, 38, '', { fontSize: '22px', color: ink }).setOrigin(1, 0);
    const target = this.gameController.getLevelConfig().targetBallLevel ?? 3;
    this.add.image(79, 114, 'characters', `ball_${target}`).setDisplaySize(64, 64);
    this.uiTexts.goal = this.add.text(126, 86, `合出${characterNames[target]}`, { fontSize: '27px', color: ink, fontStyle: 'bold' });
    this.uiTexts.progress = this.add.text(126, 130, '', { fontSize: '20px', color: '#8b7c64' });
    this.uiTexts.shots = this.add.text(48, 168, '', { fontSize: '21px', color: ink });
    this.add.text(606, 78, '下一位', { fontSize: '18px', color: '#8b7c64' }).setOrigin(0.5);
    this.nextPreview = this.add.image(606, 129, 'characters', `ball_${this.shotQueue.peek()[1]}`).setDisplaySize(50, 50);
    this.comboText = this.add.text(360, 390, '', {
      fontSize: '42px', color: '#fff7cd', fontStyle: 'bold', stroke: '#785d42', strokeThickness: 5
    }).setOrigin(0.5).setDepth(10).setVisible(false);
  }

  private updateUI() {
    const state = this.gameController.getGameState();
    this.uiTexts.level.setText(`${state.currentLevel}/8 · ${this.gameController.getLevelConfig().title ?? "下班团子"}`);
    this.uiTexts.score.setText(`快乐值 ${state.score}`);
    this.uiTexts.shots.setText(`还有 ${state.shotsRemaining} 球`);
    this.uiTexts.progress.setText(state.highestBallLevel === 1 ? '同款相碰 → 升一级' : `本关合成：${characterNames[state.highestBallLevel]}`);
    this.shakeLabel?.setText(`抱团取暖 ×${this.shakesRemaining}`);
    this.swapLabel?.setText(`换个搭子 ×${this.swapsRemaining}`);
    this.shakeLabel?.parentContainer?.setAlpha(this.shakesRemaining > 0 ? 1 : 0.45);
    this.swapLabel?.parentContainer?.setAlpha(this.swapsRemaining > 0 ? 1 : 0.45);
    if (this.uiTexts.charge) {
      const full = this.charge.rewards >= this.charge.limit;
      this.uiTexts.charge.setText(full ? '本关充能奖励已领满' : `抱团充能 ${this.charge.charge}/4 · 3 连合后双倍充能`);
      this.chargeBar?.clear().fillStyle(0xe6decd).fillRoundedRect(180, 360, 360, 8, 4);
      const progress = full ? 1 : this.charge.charge / this.charge.threshold;
      if (progress > 0) this.chargeBar?.fillStyle(0xee976e).fillRoundedRect(180, 360, 360 * progress, 8, 4);
    }
    const queue = this.shotQueue.peek();
    this.launcherPreview?.setTexture('characters', `ball_${queue[0]}`).setDisplaySize(56, 56);
    this.nextPreview.setTexture('characters', `ball_${queue[1]}`).setDisplaySize(50, 50);
    if (state.combo > 1) {
      this.comboText.setText(`${state.combo} 连合！继续碰！`).setVisible(true);
      this.tweens.killTweensOf(this.comboText);
      this.tweens.add({ targets: this.comboText, scale: { from: 1.25, to: 1 }, duration: 180 });
    }
  }

  private swapBall() {
    if (this.resolving || this.swapsRemaining <= 0 || !this.canShoot) return;
    if (this.shotQueue.at(0) === this.shotQueue.at(1)) {
      this.uiTexts.hint.setText('这两位一样，留着机会给下一次吧');
      return;
    }
    this.shotQueue.swap();
    this.swapsRemaining--;
    this.updateUI();
    this.platform.playSound('swap');
  }

  private shakeBoard() {
    if (this.resolving || this.shakesRemaining <= 0 || this.balls.length === 0) return;
    this.shakesRemaining--;
    const balls = this.balls;
    for (let i = 0, length = balls.length; i < length; i++) {
      const body = balls[i].body;
      (balls[i].sprite as Phaser.GameObjects.Image & Phaser.Physics.Matter.Components.Sleep).setAwake();
      this.matter.body.setVelocity(body, { x: (360 - body.position.x) * 0.025, y: -7 });
    }
    this.shotStartedAt = this.time.now;
    this.settledSince = null;
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
      if (pointer.y < 210 || pointer.y > 1100) return;
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
      if (pointer.y < 210 || pointer.y > 1100) {
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
    this.aimAngle = Phaser.Math.Clamp(Math.atan2(Math.max(1, pointer.y - startY), pointer.x - startX), 0.2, Math.PI - 0.2);
    
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
      const reward = this.add.text(360, 460, '充满了！抱团取暖 +1', {
        fontSize: '30px', color: '#547044', backgroundColor: '#fff9e7', padding: { x: 16, y: 10 }
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

  private removeBall(ball: Ball) {
    const index = this.balls.indexOf(ball);
    if (index > -1) {
      this.balls.splice(index, 1);
    }

    this.matter.world.remove(ball.body);
    ball.sprite.destroy();
  }

  private createMergeEffect(x: number, y: number, color: number) {
    const circle = this.add.circle(x, y, 10, color, 0.8);
    this.tweens.add({
      targets: circle,
      radius: 40,
      alpha: 0,
      duration: 300,
      onComplete: () => circle.destroy()
    });

    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const particle = this.add.circle(x, y, 4, color);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 50,
        y: y + Math.sin(angle) * 50,
        alpha: 0,
        duration: 400,
        onComplete: () => particle.destroy()
      });
    }
  }

  private showScorePopup(x: number, y: number, score: number, level: number) {
    const lines = ['', '', '脑子放空了', '我没事，真的', '咖啡续命！', '卡打了，人走了', '正在加载灵魂', '摸鱼使我快乐', '躺平也很可爱', '先溜为敬！', '准点下班！'];
    const text = this.add.text(Phaser.Math.Clamp(x, 150, 570), y, `${lines[level]}\n+${score}`, {
      fontSize: '24px',
      color: '#49392d',
      align: 'center', stroke: '#fff9e7', strokeThickness: 5,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(12);

    this.scorePopups.push(text);

    this.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 1000,
      onComplete: () => {
        const index = this.scorePopups.indexOf(text);
        if (index > -1) this.scorePopups.splice(index, 1);
        text.destroy();
      }
    });
  }

  private showVictory() {
    const state = this.gameController.getGameState();
    const target = this.gameController.getLevelConfig().targetBallLevel ?? state.highestBallLevel;
    const shade = this.add.rectangle(360, 660, 620, 870, 0xfffcf2, 0.9).setDepth(20);
    const hero = this.add.image(360, 610, 'characters', `ball_${target}`).setDisplaySize(190, 190).setDepth(21);
    this.add.text(360, 455, '坏情绪，碰掉了！', { fontSize: '42px', color: ink, fontStyle: 'bold' }).setOrigin(0.5).setDepth(21);
    this.add.text(360, 775, `${characterNames[target]} 到岗\n本轮最高 ${this.gameController.getRunSummary().bestCombo} 连合`, {
      fontSize: '28px', color: ink, align: 'center', lineSpacing: 16
    }).setOrigin(0.5).setDepth(21);
    this.tweens.add({ targets: hero, y: 580, duration: 450, yoyo: true, repeat: 1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: shade, alpha: { from: 0, to: 1 }, duration: 200 });
  }

  update(time: number) {
    this.gameController.updateCombo(time);
    const state = this.gameController.getGameState();
    this.comboBar?.clear();
    if (state.combo > 1 && !this.resolving) {
      const remaining = Math.max(0, 1 - (time - state.comboTimer) / this.gameConfig.scoring.comboDecayTime);
      this.comboBar?.fillStyle(0xee976e).fillRect(240, 420, 240 * remaining, 5);
    }
    this.matchRings?.clear();
    if (this.isAiming) {
      const next = this.shotQueue.at(0);
      const ringRadius = (this.gameController.getBallConfig(next)?.radius ?? 26) * state.ballSizeMultiplier + 7;
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
    const current = this.gameController.getGameState();
    const status = this.gameController.checkLevelComplete();
    if (status === 'win') {
      this.resolving = true;
      this.canShoot = false;
      this.isAiming = false;
      this.aimLine?.setVisible(false);
      this.aimArrow?.setVisible(false);
      this.uiTexts.hint?.setText('情绪释放成功！领取一份小福利');
      this.showVictory();
      this.time.delayedCall(1700, () => {
        const destination = this.gameController.getLevelConfig().chapterEnd ? 'GameOverScene' : 'UpgradeScene';
        this.scene.start(destination, { gameController: this.gameController, gameConfig: this.gameConfig, won: true });
      });
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
    const hint = this.shakesRemaining > 0 ? '最后一球结算中 · 还能用聚拢救场' : '最后一球结算中…';
    this.uiTexts.hint?.setText(hint);
    const moving = this.balls.some(ball => !ball.body.isSleeping && Math.hypot(ball.body.velocity.x, ball.body.velocity.y) > 0.3);
    if (moving || time - this.shotStartedAt < 1000) {
      this.settledSince = null;
      return;
    }
    if (this.settledSince === null) this.settledSince = time;
    // 留出救场时间，按下聚拢会重新开始计时。
    const rescueDelay = this.shakesRemaining > 0 ? 2500 : 700;
    if (time - this.settledSince < rescueDelay) return;
    this.resolving = true;
    this.scene.start('GameOverScene', { gameController: this.gameController, gameConfig: this.gameConfig, won: false });
  }
}
