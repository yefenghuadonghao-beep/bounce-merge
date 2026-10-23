import Phaser from 'phaser';
import { GameController } from '../core/GameController';
import { GameConfig } from '../types';

interface Ball {
  body: MatterJS.BodyType;
  sprite: Phaser.GameObjects.Arc;
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

  create() {
    this.matter.world.setBounds(0, 0, this.gameConfig.width, this.gameConfig.height);
    this.matter.world.setGravity(0, this.gameConfig.physics.gravity);

    this.add.rectangle(0, 0, this.gameConfig.width, this.gameConfig.height, 0x0f1419).setOrigin(0);

    this.createPegBoard();
    this.createUI();
    this.createAimingLine();
    this.setupInput();
    this.setupCollisions();
  }

  private createPegBoard() {
    const { pegRows, pegColumns, pegRadius, pegColor, startY, spacing } = this.gameConfig.board;
    
    for (let row = 0; row < pegRows; row++) {
      const offsetX = (row % 2) * (spacing / 2);
      const cols = row % 2 === 0 ? pegColumns : pegColumns - 1;
      
      for (let col = 0; col < cols; col++) {
        const x = offsetX + spacing + col * spacing;
        const y = startY + row * (spacing * 0.8);
        
        const peg = this.add.circle(x, y, pegRadius, pegColor);
        this.matter.add.gameObject(peg, {
          isStatic: true,
          restitution: this.gameConfig.physics.restitution,
          friction: this.gameConfig.physics.friction
        });
      }
    }

    const wallThickness = 10;
    this.matter.add.rectangle(wallThickness / 2, this.gameConfig.height / 2, wallThickness, this.gameConfig.height, {
      isStatic: true,
      restitution: 0.8
    });
    this.matter.add.rectangle(this.gameConfig.width - wallThickness / 2, this.gameConfig.height / 2, wallThickness, this.gameConfig.height, {
      isStatic: true,
      restitution: 0.8
    });
    this.matter.add.rectangle(this.gameConfig.width / 2, this.gameConfig.height - wallThickness / 2, this.gameConfig.width, wallThickness, {
      isStatic: true,
      restitution: 0.3
    });
  }

  private createUI() {
    const state = this.gameController.getGameState();
    const config = this.gameController.getLevelConfig();

    this.uiTexts.level = this.add.text(20, 20, `关卡 ${state.currentLevel}`, {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    this.uiTexts.score = this.add.text(20, 55, `分数: ${state.score} / ${config.targetScore}`, {
      fontSize: '24px',
      color: '#feca57'
    });

    this.uiTexts.shots = this.add.text(this.gameConfig.width - 20, 20, `剩余: ${state.shotsRemaining}`, {
      fontSize: '24px',
      color: '#48dbfb'
    }).setOrigin(1, 0);

    this.comboText = this.add.text(this.gameConfig.width / 2, 150, '', {
      fontSize: '48px',
      color: '#ff6b6b',
      fontStyle: 'bold'
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
    const sprite = this.add.circle(this.gameConfig.launcher.startX, this.gameConfig.launcher.startY, radius, ballConfig.color);
    
    this.matter.add.gameObject(sprite, {
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

    this.add.text(sprite.x, sprite.y, level.toString(), {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
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
      const sprite = this.add.circle(midX, midY, radius, newConfig.color);
      
      this.matter.add.gameObject(sprite, {
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

      this.add.text(sprite.x, sprite.y, newLevel.toString(), {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);
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
