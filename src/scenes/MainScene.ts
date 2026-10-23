import Phaser from 'phaser';
import { GameController } from '../core/GameController';
import { GameConfig } from '../types';

interface Ball {
  body: MatterJS.BodyType;
  sprite: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
  level: number;
}

export class MainScene extends Phaser.Scene {
  private gameController!: GameController;
  private gameConfig!: GameConfig;
  private balls: Ball[] = [];
  private aimLine!: Phaser.GameObjects.Line;
  private aimArrow!: Phaser.GameObjects.Triangle;
  private isAiming: boolean = false;
  private aimAngle: number = 0;
  private uiTexts: { [key: string]: Phaser.GameObjects.Text } = {};
  private canShoot: boolean = true;
  private activeBalls: number = 0;
  private scorePopups: Phaser.GameObjects.Text[] = [];
  private comboText!: Phaser.GameObjects.Text;
  
  // Rail margins for physics walls alignment
  private readonly RAIL_MARGIN = 50;
  // Floor position at top of bottom candy bar (visual measurement from background.jpg)
  private readonly FLOOR_Y = 1110;
  // Sprite scale factor to account for transparent padding in PNGs
  // Sprites have ~50% visible content, so scale up 2x to match physics body
  private readonly SPRITE_SCALE = 2.0;

  constructor() {
    super({ key: 'MainScene' });
  }

  init(data: { gameController: GameController; gameConfig: GameConfig }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
    this.balls = [];
    this.isAiming = false;
    this.canShoot = true;
    this.activeBalls = 0;
  }

  preload() {
    // Load background if specified
    if (this.gameConfig.background) {
      this.load.image('background', this.gameConfig.background);
    }

    // Load ball sprites
    for (let level = 1; level <= this.gameController.getMaxBallLevel(); level++) {
      const ballConfig = this.gameController.getBallConfig(level);
      if (ballConfig?.sprite) {
        this.load.image(`ball_${level}`, ballConfig.sprite);
      }
    }
  }

  create() {
    this.matter.world.setBounds(0, 0, this.gameConfig.width, this.gameConfig.height);
    this.matter.world.setGravity(0, this.gameConfig.physics.gravity);

    // Add background image or solid color
    if (this.gameConfig.background && this.textures.exists('background')) {
      this.add.image(0, 0, 'background').setOrigin(0).setDisplaySize(this.gameConfig.width, this.gameConfig.height);
    } else {
      this.add.rectangle(0, 0, this.gameConfig.width, this.gameConfig.height, 0x0f1419).setOrigin(0);
    }

    this.createPegBoard();
    this.createUI();
    this.createAimingLine();
    this.setupInput();
    this.setupCollisions();
    
    // Debug mode: seed balls via URL param ?debug=seed
    this.checkDebugMode();
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
    
    if (ballConfig.sprite && this.textures.exists(spriteKey)) {
      sprite = this.add.image(x, y, spriteKey);
      // Scale sprite to account for transparent padding - visible fruit should match physics body
      sprite.setDisplaySize(radius * 2 * this.SPRITE_SCALE, radius * 2 * this.SPRITE_SCALE);
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
  }

  private createPegBoard() {
    const { pegRows, pegColumns, pegRadius, pegColor, pegStrokeColor, pegStrokeWidth, startY, spacing } = this.gameConfig.board;
    
    // Calculate total width needed for the peg grid
    // For even rows: pegColumns pegs, for odd rows: pegColumns - 1
    const maxCols = pegColumns;
    const gridWidth = (maxCols - 1) * spacing;
    
    // Center the grid horizontally between the rails
    const playAreaWidth = this.gameConfig.width - (this.RAIL_MARGIN * 2);
    const startX = this.RAIL_MARGIN + (playAreaWidth - gridWidth) / 2;
    
    for (let row = 0; row < pegRows; row++) {
      const rowOffset = (row % 2) * (spacing / 2);
      const cols = row % 2 === 0 ? pegColumns : pegColumns - 1;
      
      for (let col = 0; col < cols; col++) {
        const x = startX + rowOffset + col * spacing;
        const y = startY + row * (spacing * 0.8);
        
        const peg = this.add.circle(x, y, pegRadius, pegColor);
        
        // Add candy-style outline
        if (pegStrokeColor !== undefined && pegStrokeWidth) {
          peg.setStrokeStyle(pegStrokeWidth, pegStrokeColor);
        }
        
        this.matter.add.gameObject(peg, {
          isStatic: true,
          restitution: this.gameConfig.physics.restitution,
          friction: this.gameConfig.physics.friction
        });
      }
    }

    // Physics walls aligned with visual rails
    const wallThickness = 10;
    
    // Left wall at inner edge of left rail
    this.matter.add.rectangle(this.RAIL_MARGIN, this.gameConfig.height / 2, wallThickness, this.gameConfig.height, {
      isStatic: true,
      restitution: 0.8
    });
    
    // Right wall at inner edge of right rail
    this.matter.add.rectangle(this.gameConfig.width - this.RAIL_MARGIN, this.gameConfig.height / 2, wallThickness, this.gameConfig.height, {
      isStatic: true,
      restitution: 0.8
    });
    
    // Bottom floor at top of candy bar (not bottom of screen)
    this.matter.add.rectangle(this.gameConfig.width / 2, this.FLOOR_Y, this.gameConfig.width, wallThickness * 2, {
      isStatic: true,
      restitution: 0.3,
      label: 'floor'
    });
  }

  private createUI() {
    const state = this.gameController.getGameState();
    const config = this.gameController.getLevelConfig();

    // Create semi-transparent panels for HUD
    const panelColor = 0x000000;
    const panelAlpha = 0.5;
    
    // Top left panel
    this.add.rectangle(10, 10, 250, 80, panelColor, panelAlpha).setOrigin(0);
    
    // Top right panel
    this.add.rectangle(this.gameConfig.width - 10, 10, 150, 50, panelColor, panelAlpha).setOrigin(1, 0);

    // Add text with stroke for better readability
    this.uiTexts.level = this.add.text(20, 20, `关卡 ${state.currentLevel}`, {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    });

    this.uiTexts.score = this.add.text(20, 55, `分数: ${state.score} / ${config.targetScore}`, {
      fontSize: '24px',
      color: '#feca57',
      stroke: '#000000',
      strokeThickness: 4
    });

    this.uiTexts.shots = this.add.text(this.gameConfig.width - 20, 20, `剩余: ${state.shotsRemaining}`, {
      fontSize: '24px',
      color: '#48dbfb',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(1, 0);

    this.comboText = this.add.text(this.gameConfig.width / 2, 150, '', {
      fontSize: '48px',
      color: '#ff6b6b',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setVisible(false);
  }

  private updateUI() {
    const state = this.gameController.getGameState();
    const config = this.gameController.getLevelConfig();

    this.uiTexts.level.setText(`关卡 ${state.currentLevel}`);
    this.uiTexts.score.setText(`分数: ${state.score} / ${config.targetScore}`);
    this.uiTexts.shots.setText(`剩余: ${state.shotsRemaining}`);

    if (state.combo > 1) {
      this.comboText.setText(`连击 x${state.combo}!`);
      this.comboText.setVisible(true);
      this.tweens.add({
        targets: this.comboText,
        scale: { from: 1.5, to: 1 },
        alpha: { from: 1, to: 0.8 },
        duration: 200
      });
    }
  }

  private createAimingLine() {
    this.aimLine = this.add.line(0, 0, 0, 0, 0, 0, 0xffffff, 0.8);
    this.aimLine.setLineWidth(3);
    this.aimLine.setVisible(false);

    this.aimArrow = this.add.triangle(0, 0, 0, 10, 10, 0, 0, -10, 0xfeca57);
    this.aimArrow.setVisible(false);
  }

  private setupInput() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.canShoot && this.activeBalls === 0) {
        this.isAiming = true;
        this.updateAim(pointer);
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isAiming) {
        this.updateAim(pointer);
      }
    });

    this.input.on('pointerup', () => {
      if (this.isAiming) {
        this.launchBall();
      }
    });
  }

  private updateAim(pointer: Phaser.Input.Pointer) {
    const startX = this.gameConfig.launcher.startX;
    const startY = this.gameConfig.launcher.startY;
    
    this.aimAngle = Phaser.Math.Angle.Between(startX, startY, pointer.x, pointer.y);
    
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
    const level = state.startingBallLevel;
    const ballConfig = this.gameController.getBallConfig(level);
    
    if (!ballConfig) return;

    const radius = ballConfig.radius * state.ballSizeMultiplier;
    const x = this.gameConfig.launcher.startX;
    const y = this.gameConfig.launcher.startY;
    
    // Use sprite if available, otherwise use procedural circle
    let sprite: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
    const spriteKey = `ball_${level}`;
    
    if (ballConfig.sprite && this.textures.exists(spriteKey)) {
      sprite = this.add.image(x, y, spriteKey);
      // Scale sprite to account for transparent padding - visible fruit should match physics body
      sprite.setDisplaySize(radius * 2 * this.SPRITE_SCALE, radius * 2 * this.SPRITE_SCALE);
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

    const velocityX = Math.cos(this.aimAngle) * this.gameConfig.launcher.launchForce * 10000;
    const velocityY = Math.sin(this.aimAngle) * this.gameConfig.launcher.launchForce * 10000;
    this.matter.body.setVelocity(body, { x: velocityX, y: velocityY });

    const ball: Ball = {
      body,
      sprite,
      level
    };

    this.balls.push(ball);
    this.activeBalls++;
    this.gameController.useShot();
    this.updateUI();
    this.canShoot = false;
  }

  private setupCollisions() {
    this.matter.world.on('collisionstart', (event: any) => {
      event.pairs.forEach((pair: any) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        const ballA = this.balls.find(b => b.body === bodyA);
        const ballB = this.balls.find(b => b.body === bodyB);

        if (ballA && ballB && this.gameController.canMerge(ballA.level, ballB.level)) {
          this.mergeBalls(ballA, ballB);
        }

        if ((bodyA.isStatic || bodyB.isStatic) && (ballA || ballB)) {
          const wallScore = this.gameController.processWallBounce();
          if (wallScore > 0) {
            this.updateUI();
          }
        }
      });
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
    this.showScorePopup(midX, midY, score);
    this.cameras.main.shake(100, 0.002 * state.combo);

    this.removeBall(ball1);
    this.removeBall(ball2);

    if (newLevel <= this.gameController.getMaxBallLevel()) {
      const radius = newConfig.radius * state.ballSizeMultiplier;
      
      // Use sprite if available, otherwise use procedural circle
      let sprite: Phaser.GameObjects.Arc | Phaser.GameObjects.Image;
      const spriteKey = `ball_${newLevel}`;
      
      if (newConfig.sprite && this.textures.exists(spriteKey)) {
        sprite = this.add.image(midX, midY, spriteKey);
        // Scale sprite to account for transparent padding - visible fruit should match physics body
        sprite.setDisplaySize(radius * 2 * this.SPRITE_SCALE, radius * 2 * this.SPRITE_SCALE);
      } else {
        sprite = this.add.circle(midX, midY, radius, newConfig.color);
      }
      
      this.matter.add.gameObject(sprite, {
        shape: { type: 'circle', radius },
        restitution: this.gameConfig.physics.restitution,
        friction: this.gameConfig.physics.friction,
        frictionAir: this.gameConfig.physics.frictionAir,
        density: this.gameConfig.physics.density,
        label: `ball_${newLevel}`
      });
      
      const body = sprite.body as MatterJS.BodyType;

      const ball: Ball = {
        body,
        sprite,
        level: newLevel
      };

      this.balls.push(ball);
      this.activeBalls++;
    }

    this.updateUI();
  }

  private removeBall(ball: Ball) {
    const index = this.balls.indexOf(ball);
    if (index > -1) {
      this.balls.splice(index, 1);
      this.activeBalls--;
    }

    ball.sprite.destroy();
    this.matter.world.remove(ball.body);
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

  private showScorePopup(x: number, y: number, score: number) {
    const text = this.add.text(x, y, `+${score}`, {
      fontSize: '24px',
      color: '#feca57',
      fontStyle: 'bold'
    }).setOrigin(0.5);

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

  update(time: number) {
    this.gameController.updateCombo(time);
    const state = this.gameController.getGameState();

    if (state.combo === 0 && this.comboText.visible) {
      this.comboText.setVisible(false);
    }

    let hasMovingBalls = false;
    this.balls.forEach(ball => {
      const velocity = ball.body.velocity;
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      
      if (speed > 0.1) {
        hasMovingBalls = true;
      }
    });

    if (!hasMovingBalls && this.activeBalls > 0 && !this.canShoot) {
      this.canShoot = true;
      this.activeBalls = 0;
      
      this.time.delayedCall(500, () => {
        const status = this.gameController.checkLevelComplete();
        if (status === 'win') {
          this.scene.start('UpgradeScene', { gameController: this.gameController, gameConfig: this.gameConfig });
        } else if (status === 'lose') {
          this.scene.start('GameOverScene', { gameController: this.gameController, gameConfig: this.gameConfig, won: false });
        }
      });
    }
  }
}
