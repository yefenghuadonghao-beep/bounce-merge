import Phaser from 'phaser';
import { GameController } from '../core/GameController';
import { Upgrade, GameConfig, LevelConfig } from '../types';
import { battlePlanEffects, battlePlans } from '../core/BattlePlan';
import { button, characterNames, ink, panel, paper, FONT_FAMILY } from '../ui/theme';
import { setupHiDpi } from '../ui/hidpi';
import { getPlatform } from '../platform';
import { assetUrl } from '../platform/assets';
import characterAtlas from '../config/characterAtlas.json';

export class UpgradeScene extends Phaser.Scene {
  private gameController!: GameController;
  private gameConfig!: GameConfig;
  private afterimageMode = false;
  private selecting = false;
  private feedback?: Phaser.GameObjects.Text;

  constructor() { super({ key: 'UpgradeScene' }); }

  init(data: { gameController: GameController; gameConfig: GameConfig; afterimageMode?: boolean }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
    this.afterimageMode = data.afterimageMode ?? false;
    this.selecting = false;
    this.feedback = undefined;
  }

  preload() {
    if (!this.textures.exists('characters')) this.load.atlas('characters', assetUrl('assets/characters/office-mochi.png'), characterAtlas);
  }

  create() {
    setupHiDpi(this);
    this.input.enabled = true;
    paper(this);
    const next = this.gameController.getNextLevelConfig();
    const late = next.requiredAfterimageMerges ? next.level >= 3 : next.level >= 5;
    this.add.text(360, 65, '过关了，下一关怎么打？', { fontFamily: FONT_FAMILY, fontSize: '40px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(360, 118, late ? '进阶战术 · 有收益，也有取舍' : '练习阶段 · 三张卡都没有负担', { fontFamily: FONT_FAMILY, fontSize: '24px', color: '#8b6041' }).setOrigin(0.5);

    panel(this, 40, 160, 640, 210);
    this.add.text(70, 180, `下一关 ${next.level} · ${next.title}`, { fontFamily: FONT_FAMILY, fontSize: '26px', color: ink, fontStyle: 'bold' });
    const target = characterNames[next.targetBallLevel ?? 3];
    const resonance = next.requiredAfterimageMerges ? ` · 共鸣 ${next.requiredAfterimageMerges} 次` : '';
    this.add.text(70, 224, `目标：${target}${resonance}`, { fontFamily: FONT_FAMILY, fontSize: '22px', color: ink });
    this.add.text(70, 260, `${next.shots} 球 · 抱团 ${next.shakes ?? 1} · 换球 ${next.swaps ?? 2}`, { fontFamily: FONT_FAMILY, fontSize: '22px', color: '#8b7c64' });
    this.add.text(70, 312, '开局', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' });
    const queue = next.shotSequence ?? [];
    for (let i = 0; i < Math.min(5, queue.length); i++) {
      this.add.image(145 + i * 57, 327, 'characters', `ball_${queue[i]}`).setDisplaySize(40, 40);
    }
    this.drawMap(next);

    const plans = battlePlans();
    for (let i = 0; i < plans.length; i++) this.createUpgradeButton(plans[i], i, next);
    this.feedback = this.add.text(360, 1110, '三选一 · 仅下一关生效 · 重试保留', { fontFamily: FONT_FAMILY, fontSize: '24px', color: '#8b6041' }).setOrigin(0.5);
    button(this, 360, 1230, 240, '返回首页', () => {
      if (this.selecting) return;
      this.selecting = true;
      this.scene.start('HomeScene', { gameController: this.gameController, gameConfig: this.gameConfig });
    });
  }

  private drawMap(level: LevelConfig) {
    const g = this.add.graphics();
    g.fillStyle(0xeee6d5).fillRoundedRect(490, 180, 160, 170, 12);
    const obstacles = level.obstacles ?? [];
    for (let i = 0; i < obstacles.length; i++) {
      const obstacle = obstacles[i];
      const x = 495 + obstacle.x * 0.21;
      const y = 185 + obstacle.y * 0.125;
      if (obstacle.radius) {
        g.fillStyle(0xd6ab63).fillCircle(x, y, obstacle.radius * 0.16);
      } else {
        const dx = Math.cos(obstacle.angle ?? 0) * (obstacle.width ?? 0) * 0.105;
        const dy = Math.sin(obstacle.angle ?? 0) * (obstacle.width ?? 0) * 0.0625;
        g.lineStyle(4, 0x94aa7f).lineBetween(x - dx, y - dy, x + dx, y + dy);
      }
    }
    const seeds = level.presetBalls ?? [];
    for (let i = 0; i < seeds.length; i++) {
      this.add.image(495 + seeds[i].x * 0.21, 185 + seeds[i].y * 0.125, 'characters', `ball_${seeds[i].level}`).setDisplaySize(16, 16);
    }
    g.fillStyle(0xee976e).fillCircle(570, 210, 5);
  }

  private createUpgradeButton(upgrade: Upgrade, index: number, next: LevelConfig) {
    const y = 400 + index * 225;
    const colors = [0xffedd6, 0xe5eff0, 0xeaf0df];
    const effects = battlePlanEffects(upgrade, next);
    const roles = ['多试两发，补齐最后一步', '控制队列，先配同款再发射', '主动聚拢，把合成接成连锁'];
    if (this.afterimageMode) roles[2] = '清影开路，也会清掉已有核心';
    const benefits = ['发射 +2', '换球 +2 · 三球轮换', '抱团 +1 · 3格充能'];
    let cost = '练习关：没有额外代价';
    if (effects.shakes < 0) cost = '取舍：抱团 -1，救场机会更少';
    if (effects.shots < 0) cost = '取舍：发射 -1，每一球都要算好';
    if (effects.swaps < 0) cost = '取舍：换球 -1，更依赖落点和聚拢';
    panel(this, 40, y, 640, 205, colors[index]);
    this.add.circle(85, y + 40, 23, 0xffffff, 0.8);
    this.add.text(85, y + 40, String(index + 1), { fontFamily: FONT_FAMILY, fontSize: '25px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(125, y + 18, upgrade.name, { fontFamily: FONT_FAMILY, fontSize: '32px', color: ink, fontStyle: 'bold' });
    this.add.text(70, y + 72, roles[index], { fontFamily: FONT_FAMILY, fontSize: '23px', color: ink });
    this.add.text(70, y + 110, benefits[index], { fontFamily: FONT_FAMILY, fontSize: '24px', color: '#547044', fontStyle: 'bold' });
    this.add.text(70, y + 174, cost, { fontFamily: FONT_FAMILY, fontSize: '19px', color: '#965c43' });
    this.add.text(640, y + 28, `下关 ${next.shots + effects.shots} 球`, { fontFamily: FONT_FAMILY, fontSize: '23px', color: '#8b6041' }).setOrigin(1, 0);
    const pick = button(this, 565, y + 126, 170, '选这张', () => {
      if (this.selecting) return;
      pick.label.setText('已装备');
      this.selectUpgrade(upgrade);
    });
  }

  private selectUpgrade(upgrade: Upgrade) {
    if (this.selecting) return;
    this.selecting = true;
    this.input.enabled = false;
    this.feedback?.setText(`已装备「${upgrade.name}」· 下一关出发！`);
    getPlatform().playSound('swap');
    this.gameController.applyUpgrade(upgrade);
    this.gameController.advanceLevel();
    this.time.delayedCall(500, () => {
      this.scene.start('MainScene', { gameController: this.gameController, gameConfig: this.gameConfig, afterimageMode: this.afterimageMode });
    });
  }
}
