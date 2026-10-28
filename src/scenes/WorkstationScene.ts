import Phaser from 'phaser';
import { WorkstationManager } from '../core/WorkstationManager';
import { WorkstationSystem } from '../core/WorkstationSystem';
import type { GameController } from '../core/GameController';
import type { GameConfig } from '../types';
import type { WorkstationConfig, WorkstationItem, WorkstationEmployee, ItemType } from '../types/workstation';
import workstationConfig from '../config/workstationConfig.json';
import { getPlatform } from '../platform';
import { button, FONT_FAMILY, ink, panel, paper } from '../ui/theme';
import { loadOfficeArt, officeProp, itemFrames } from '../ui/officeArt';
import { setupHiDpi } from '../ui/hidpi';
import { workstationGrowth } from '../ui/workstationGrowth';

export class WorkstationScene extends Phaser.Scene {
  private system!: WorkstationSystem;
  private config!: WorkstationConfig;
  private manager!: WorkstationManager;
  private platform = getPlatform();
  private gameController!: GameController;
  private gameConfig!: GameConfig;
  
  private deskGraphics: Map<number, Phaser.GameObjects.Container> = new Map();
  private inboxGraphics: Phaser.GameObjects.Container[] = [];
  private inboxTitle?: Phaser.GameObjects.Text;
  private pageLabel?: Phaser.GameObjects.Text;
  private previousPage?: Phaser.GameObjects.Text;
  private nextPage?: Phaser.GameObjects.Text;
  private inboxPage = 0;
  private rewardTitle?: Phaser.GameObjects.Text;
  private rewardHint?: Phaser.GameObjects.Text;
  private rewardButton?: Phaser.GameObjects.Text;
  private rewardMessage = '';
  private growthTitle?: Phaser.GameObjects.Text;
  private growthHero?: Phaser.GameObjects.Image;
  private growthRecipe?: Phaser.GameObjects.Text;
  private growthStatus?: Phaser.GameObjects.Text;
  private growthBar?: Phaser.GameObjects.Graphics;
  private claiming = false;
  private leaving = false;
  private lifecycle = 0;
  private loaded = false;
  private saveFailed = false;
  private returnTo?: 'UpgradeScene';
  private afterimageMode = false;
  private collectAllButton?: Phaser.GameObjects.Text;
  private coinsText!: Phaser.GameObjects.Text;
  private unlockButton?: Phaser.GameObjects.Container;
  private bossInspectionUI?: Phaser.GameObjects.Container;
  
  private draggedContent: { source: 'inbox' | 'desk'; index: number; content: WorkstationItem | WorkstationEmployee } | null = null;
  private dragPreview: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'WorkstationScene' });
  }

  init(data: { gameController: GameController; gameConfig: GameConfig; returnTo?: 'UpgradeScene'; afterimageMode?: boolean }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
    this.returnTo = data.returnTo;
    this.afterimageMode = data.afterimageMode ?? false;
    this.lifecycle++;
    this.loaded = false;
    this.saveFailed = false;
    this.claiming = false;
    this.leaving = false;
    this.inboxPage = 0;
    this.rewardMessage = '';
    this.deskGraphics.clear();
    this.inboxGraphics = [];
    this.inboxTitle = undefined;
    this.pageLabel = undefined;
    this.previousPage = undefined;
    this.nextPage = undefined;
    this.rewardTitle = undefined;
    this.rewardHint = undefined;
    this.rewardButton = undefined;
    this.growthTitle = undefined;
    this.growthHero = undefined;
    this.growthRecipe = undefined;
    this.growthStatus = undefined;
    this.growthBar = undefined;
    this.collectAllButton = undefined;
    this.unlockButton = undefined;
    this.bossInspectionUI = undefined;
    this.draggedContent = null;
    this.dragPreview = null;
  }

  preload() { loadOfficeArt(this); }

  async create() {
    setupHiDpi(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.config = workstationConfig as WorkstationConfig;
    this.manager = WorkstationManager.getInstance(this.platform);
    const lifecycle = this.lifecycle;
    try {
      const system = await this.manager.getSystem();
      if (lifecycle !== this.lifecycle) return;
      this.system = system;
      this.loaded = true;
    } catch {
      if (lifecycle === this.lifecycle) this.showLoadFailure();
      return;
    }
    
    paper(this);
    this.createHeader();
    this.createTutorial();
    this.createDesks();
    this.createRewards();
    this.createInbox();
    this.createButtons();
    
    // Auto-save every 5 seconds
    this.time.addEvent({
      delay: 5000,
      callback: () => void this.saveWorkstation(),
      loop: true
    });
    
    // Update every second
    this.time.addEvent({
      delay: 1000,
      callback: this.updateProduction,
      callbackScope: this,
      loop: true
    });
    
    // Input for drag
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.cancelDrag, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.cancelDrag, this);
  }

  private showLoadFailure() {
    paper(this);
    panel(this, 50, 380, 620, 450);
    this.add.text(360, 460, '工位还没读出来', { fontFamily: FONT_FAMILY, fontSize: '36px', color: ink, fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(360, 530, '你的材料先保留着，重试后继续布置', { fontFamily: FONT_FAMILY, fontSize: '24px', color: '#8b7c64' }).setOrigin(0.5);
    button(this, 360, 640, 500, '重新读取', () => this.scene.restart({ gameController: this.gameController, gameConfig: this.gameConfig, returnTo: this.returnTo, afterimageMode: this.afterimageMode }));
    button(this, 360, 750, 500, '返回首页', () => this.scene.start('HomeScene', { gameController: this.gameController, gameConfig: this.gameConfig }));
  }

  private async saveWorkstation() {
    if (!this.loaded) return false;
    const lifecycle = this.lifecycle;
    try {
      await this.manager.save();
      if (lifecycle === this.lifecycle && this.saveFailed) {
        this.saveFailed = false;
        this.updateRewards();
      }
      return true;
    } catch {
      if (lifecycle === this.lifecycle) {
        this.saveFailed = true;
        this.updateRewards();
      }
      return false;
    }
  }

  private createHeader() {
    this.add.image(360, 550, 'office-room').setDisplaySize(720, 1080).setAlpha(0.18);
    panel(this, 28, 266, 664, 648, 0xf1ead8);
    this.add.text(360, 40, '我的下班事务所', {
      fontFamily: FONT_FAMILY,
      fontSize: '32px',
      color: ink,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Back button
    const backBtn = this.add.text(32, 40, this.returnTo ? '← 选卡' : '← 地图', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: ink
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    
    backBtn.on('pointerdown', () => void this.leaveWorkstation());

    // Coins and buttons row
    const topY = 90;
    
    this.coinsText = this.add.text(80, topY, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '22px',
      color: ink,
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);
    
    this.updateCoinsDisplay();
  }
  
  private createTutorial() {
    panel(this, 28, 130, 664, 120, 0xeaf0df);
    this.growthTitle = this.add.text(52, 145, '', { fontFamily: FONT_FAMILY, fontSize: '24px', color: ink, fontStyle: 'bold' });
    this.growthRecipe = this.add.text(52, 180, '', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#547044' });
    this.growthStatus = this.add.text(52, 211, '', { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#8b7c64' });
    this.growthHero = this.add.image(624, 178, 'characters', 'ball_1').setDisplaySize(70, 70);
    this.growthBar = this.add.graphics();
    this.updateGrowth();
  }

  private updateGrowth() {
    const growth = workstationGrowth(this.system.getState(), this.config);
    this.growthTitle?.setText(growth.title);
    this.growthHero?.setTexture('characters', `ball_${growth.face}`).setDisplaySize(70, 70);
    this.growthRecipe?.setText(growth.recipe);
    this.growthStatus?.setText(growth.status);
    this.growthBar?.clear().fillStyle(0xd6dec4).fillRoundedRect(52, 237, 616, 6, 3);
    if (growth.progress > 0) this.growthBar?.fillStyle(0x82976a).fillRoundedRect(52, 237, 616 * growth.progress, 6, 3);
  }

  private async leaveWorkstation() {
    if (this.claiming || this.leaving) return;
    this.leaving = true;
    this.cancelDrag();
    const lifecycle = this.lifecycle;
    const saved = await this.saveWorkstation();
    if (lifecycle !== this.lifecycle) return;
    if (!saved) {
      this.leaving = false;
      return;
    }
    if (this.returnTo) {
      this.scene.start('UpgradeScene', { gameController: this.gameController, gameConfig: this.gameConfig, afterimageMode: this.afterimageMode });
    } else {
      this.scene.start('HomeScene', { gameController: this.gameController, gameConfig: this.gameConfig, routeMode: this.afterimageMode ? 'afterimage' : 'classic' });
    }
  }

  private createButtons() {
    this.collectAllButton?.destroy();
    this.unlockButton?.destroy();
    this.unlockButton = undefined;
    const topY = 90;
    const state = this.system.getState();
    const nextCost = this.system.getNextUnlockCost();
    
    // Collect all button
    const collectAllBtn = this.add.text(360, topY, '全部收取', {
      fontFamily: FONT_FAMILY,
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#4a9d5f',
      padding: { x: 12, y: 6 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.collectAllButton = collectAllBtn;
    
    collectAllBtn.on('pointerdown', () => {
      if (this.claiming || this.leaving) return;
      const collected = this.system.collectAllCoins();
      if (collected > 0) {
        this.showCoinReward(360, 180, collected);
        this.updateUI();
      }
    });
    
    // Unlock button
    if (nextCost !== null) {
      const container = this.add.container(580, topY);
      
      const btn = this.add.text(0, 0, `解锁 ${nextCost}币`, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: state.coins >= nextCost ? '#4a9d5f' : '#999999',
        padding: { x: 12, y: 6 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      
      btn.on('pointerdown', () => this.unlockNextDesk());
      
      container.add(btn);
      this.unlockButton = container;
    }
  }

  private createDesks() {
    const state = this.system.getState();
    const cols = 3;
    const startX = 60;
    const startY = 274;
    const spacing = 200;
    const slotWidth = 180;
    const slotHeight = 148;
    
    for (let i = 0; i < state.desks.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = startX + col * spacing + slotWidth / 2;
      const y = startY + row * 160 + slotHeight / 2;
      
      const container = this.add.container(x, y);
      
      const desk = state.desks[i];
      const bgColor = desk.unlocked ? 0xfff9eb : 0xe0d9c8;
      const bg = this.add.rectangle(0, 0, slotWidth, slotHeight, bgColor, 1)
        .setStrokeStyle(1, 0xcbbd9f);
      container.add(bg);
      
      if (desk.unlocked) {
        bg.setInteractive({ useHandCursor: true, dropZone: true });
        bg.on('pointerdown', () => this.onDeskPointerDown(i));
      } else {
        // Show lock and cost
        const lockText = officeProp(this, 0, -12, 0, 126).setAlpha(0.25);

        const costIndex = i - this.config.initialDesks;
        const cost = this.config.deskUnlockCost[costIndex];
        if (cost) {
          const costText = this.add.text(0, 54, `待布置 · ${cost}币`, {
            fontFamily: FONT_FAMILY,
            fontSize: '16px',
            color: '#8b7c64'
          }).setOrigin(0.5);
          container.add(costText);
        }
        
        container.add(lockText);
      }
      container.setData('unlocked', desk.unlocked);
      
      this.deskGraphics.set(i, container);
    }
    
    this.renderDesks();
  }

  private renderDesks() {
    const state = this.system.getState();
    
    for (let i = 0; i < state.desks.length; i++) {
      const container = this.deskGraphics.get(i);
      if (!container) continue;

      // 解锁后清理锁标记，并让原背景接收拖拽操作。
      if (state.desks[i].unlocked && !container.getData('unlocked')) {
        while (container.length > 1) container.remove(container.list[1], true);
        const bg = container.list[0] as Phaser.GameObjects.Rectangle;
        bg.setFillStyle(0xf5ecd7);
        bg.setInteractive({ useHandCursor: true, dropZone: true });
        bg.on('pointerdown', () => this.onDeskPointerDown(i));
        container.setData('unlocked', true);
        container.setData('content', null);
      }
      
      const content = state.desks[i].content;
      const signature = content ? `${content.id}-${content.type}-${'level' in content ? content.level : 'employee'}` : 'empty';
      if (container.getData('content') === signature) {
        const coins = container.getByName('income') as Phaser.GameObjects.Text | null;
        if (coins && content && 'producedCoins' in content) coins.setText(`${Math.floor(content.producedCoins)}币`);
        continue;
      }
      container.setData('content', signature);

      // Remove old content (keep background and lock)
      while (container.length > (state.desks[i].unlocked ? 1 : 3)) {
        const child = container.list[state.desks[i].unlocked ? 1 : 3];
        this.tweens.killTweensOf(child);
        container.remove(child, true);
      }
      
      const desk = state.desks[i];
      if (desk.unlocked) {
        container.add(officeProp(this, 0, 2, 0, 144));
        container.add(this.add.text(-76, -63, String(i + 1).padStart(2, '0'), { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#9b8e75' }));
      }
      if (desk.occupied && desk.content) {
        if ('producedCoins' in desk.content) {
          this.renderEmployee(container, desk.content as WorkstationEmployee, i);
        } else {
          this.renderItem(container, desk.content as WorkstationItem);
        }
      }
    }
  }

  private renderItem(container: Phaser.GameObjects.Container, item: WorkstationItem) {
    const icon = officeProp(this, 22, -7, itemFrames[item.type], 78);
    const label = this.add.text(0, 53, `${this.itemName(item.type)} · ${item.level}级`, { fontFamily: FONT_FAMILY, fontSize: '18px', color: ink, backgroundColor: '#fff8e5', padding: { x: 8, y: 3 } }).setOrigin(0.5);
    container.add([icon, label]);
  }

  private itemName(type: ItemType) {
    return { document: '文件', coffee: '咖啡', package: '快递', keyboard: '键盘', mouse: '鼠标', plant: '绿植' }[type];
  }

  private renderEmployee(container: Phaser.GameObjects.Container, employee: WorkstationEmployee, deskIndex: number) {
    const face = { intern: 1, junior: 4, senior: 5, lead: 7, manager: 10 }[employee.type];
    const icon = this.add.image(30, -23, 'characters', `ball_${face}`).setDisplaySize(72, 72);
    this.tweens.add({ targets: icon, y: -29, angle: 4, duration: 1400 + deskIndex * 100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const coins = this.add.text(0, 45, `${Math.floor(employee.producedCoins)}币`, { fontFamily: FONT_FAMILY, fontSize: '19px', color: '#816227', backgroundColor: '#fff3cd', padding: { x: 12, y: 4 } }).setOrigin(0.5).setName('income').setInteractive({ useHandCursor: true });
    coins.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.collectFromDesk(deskIndex);
    });
    container.add([icon, coins]);
  }

  private createRewards() {
    panel(this, 28, 930, 664, 100, 0xffedd6);
    officeProp(this, 68, 980, itemFrames.package, 58);
    this.rewardTitle = this.add.text(110, 948, '', { fontFamily: FONT_FAMILY, fontSize: '23px', color: ink, fontStyle: 'bold' });
    this.rewardHint = this.add.text(110, 985, '', { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#8b6041', wordWrap: { width: 380 } });
    this.rewardButton = this.add.text(580, 976, '', { fontFamily: FONT_FAMILY, fontSize: '24px', color: ink, fontStyle: 'bold', backgroundColor: '#ee976e', padding: { x: 20, y: 18 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.rewardButton.on('pointerdown', () => void this.claimRewards());
    this.updateRewards();
  }

  private updateRewards() {
    const pending = this.system.getState().journey?.pendingRewards ?? [];
    const count = pending.reduce((sum, reward) => sum + reward.items.length, 0);
    this.rewardTitle?.setText(`通关快递 · 待收 ${count} 件`);
    let hint = '金币已到账 · 拆开材料养搭子';
    if (count === 0) hint = '继续闯关，就有新材料送到这里';
    if (this.rewardMessage) hint = this.rewardMessage;
    if (this.saveFailed) hint = '尚未保存，请稍后重试，暂留在工位';
    this.rewardHint?.setText(hint);
    let label = '领取';
    if (count === 0) label = '已收齐';
    if (this.claiming) label = '领取中';
    this.rewardButton?.setText(label).setAlpha(count > 0 && !this.claiming ? 1 : 0.5);
  }

  private async claimRewards() {
    if (this.claiming || this.leaving) return;
    const pending = this.system.getState().journey?.pendingRewards ?? [];
    if (!pending.some(reward => reward.items.length > 0)) return;
    this.cancelDrag();
    this.claiming = true;
    this.rewardMessage = '';
    this.updateRewards();
    const lifecycle = this.lifecycle;
    const previousCount = this.system.getState().inbox.length;
    try {
      const result = await this.manager.claimStageRewards();
      if (lifecycle !== this.lifecycle) return;
      if (result.claimed > 0) {
        this.inboxPage = Math.floor(previousCount / 6);
        this.rewardMessage = `收下 ${result.claimed} 件，拖入工位开始合成`;
      }
      if (result.remaining > 0) this.rewardMessage = `余 ${result.remaining} 件已保留，腾出收件箱再领`;
      if (result.claimed > 0) this.platform.playSound('swap');
      this.updateUI();
    } catch {
      if (lifecycle !== this.lifecycle) return;
      this.rewardMessage = '暂未收好，请点领取重试';
    } finally {
      if (lifecycle === this.lifecycle) {
        this.claiming = false;
        this.updateRewards();
      }
    }
  }

  private createInbox() {
    panel(this, 28, 1045, 664, 205);
    this.inboxTitle = this.add.text(52, 1062, '', { fontFamily: FONT_FAMILY, fontSize: '21px', color: ink, fontStyle: 'bold' });
    this.previousPage = this.add.text(90, 1220, '← 上页', { fontFamily: FONT_FAMILY, fontSize: '21px', color: ink, padding: { x: 12, y: 10 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.nextPage = this.add.text(630, 1220, '下页 →', { fontFamily: FONT_FAMILY, fontSize: '21px', color: ink, padding: { x: 12, y: 10 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.pageLabel = this.add.text(360, 1220, '', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#8b7c64' }).setOrigin(0.5);
    this.previousPage.on('pointerdown', () => this.changeInboxPage(-1));
    this.nextPage.on('pointerdown', () => this.changeInboxPage(1));
    this.renderInbox();
  }

  private changeInboxPage(direction: number) {
    if (this.claiming || this.leaving) return;
    this.cancelDrag();
    const lastPage = Math.max(0, Math.ceil(this.system.getState().inbox.length / 6) - 1);
    this.inboxPage = Math.max(0, Math.min(lastPage, this.inboxPage + direction));
    this.renderInbox();
  }

  private renderInbox() {
    const old = this.inboxGraphics;
    for (let i = 0; i < old.length; i++) old[i].destroy();
    this.inboxGraphics = [];
    const state = this.system.getState();
    const pages = Math.max(1, Math.ceil(state.inbox.length / 6));
    this.inboxPage = Math.min(this.inboxPage, pages - 1);
    this.inboxTitle?.setText(`收件箱 ${state.inbox.length}/${this.config.maxInboxSize} · 同款同级可合并`);
    this.pageLabel?.setText(`${this.inboxPage + 1} / ${pages} 页`);
    this.previousPage?.setAlpha(this.inboxPage > 0 ? 1 : 0.35);
    this.nextPage?.setAlpha(this.inboxPage < pages - 1 ? 1 : 0.35);
    const offset = this.inboxPage * 6;
    for (let i = offset; i < Math.min(state.inbox.length, offset + 6); i++) {
      const item = state.inbox[i];
      const container = this.add.container(90 + (i - offset) * 100, 1144);
      const bg = this.add.rectangle(0, 0, 84, 100, 0xf3ead4).setStrokeStyle(1, 0xd7c9ab).setInteractive({ useHandCursor: true });
      const icon = officeProp(this, 0, -6, itemFrames[item.type], 76);
      const levelText = this.add.text(0, 38, `${item.level}级`, { fontFamily: FONT_FAMILY, fontSize: '16px', color: ink }).setOrigin(0.5);
      container.add([bg, icon, levelText]);
      this.inboxGraphics.push(container);
      bg.on('pointerdown', () => this.startDragFromInbox(i, item));
    }
  }

  private startDragFromInbox(index: number, item: WorkstationItem) {
    if (this.claiming || this.leaving) return;
    this.draggedContent = { source: 'inbox', index, content: item };
    this.createDragPreview(item);
  }

  private onDeskPointerDown(deskIndex: number) {
    if (this.claiming || this.leaving) return;
    const desk = this.system.getState().desks[deskIndex];
    if (!desk.occupied || !desk.content) return;
    
    this.draggedContent = { source: 'desk', index: deskIndex, content: desk.content };
    this.createDragPreview(desk.content);
  }

  private createDragPreview(content: WorkstationItem | WorkstationEmployee) {
    if (this.dragPreview) {
      this.dragPreview.destroy();
    }
    
    const pointer = this.input.activePointer;
    const position = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const container = this.add.container(position.x, position.y);
    container.setDepth(1000);
    container.setAlpha(0.8);
    
    if ('producedCoins' in content) {
      container.add(this.add.image(0, 0, 'characters', 'ball_1').setDisplaySize(100, 100));
    } else {
      container.add(officeProp(this, 0, 0, itemFrames[content.type], 100));
    }
    container.setScale(1.12);
    this.dragPreview = container;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (this.dragPreview) {
      const position = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.dragPreview.setPosition(position.x, position.y);
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    if (!this.draggedContent || !this.dragPreview) return;
    
    const position = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    let droppedOnDesk = -1;
    
    // Check which desk we're over
    const desks = this.system.getState().desks;
    for (let index = 0; index < desks.length; index++) {
      const container = this.deskGraphics.get(index);
      if (!container) continue;
      const bounds = container.getBounds();
      if (bounds.contains(position.x, position.y)) {
        droppedOnDesk = index;
        break;
      }
    }
    
    if (droppedOnDesk !== -1) {
      this.handleDrop(droppedOnDesk);
    }
    
    this.cancelDrag();
  }

  private cancelDrag() {
    this.dragPreview?.destroy();
    this.dragPreview = null;
    this.draggedContent = null;
  }

  private handleDrop(targetDeskIndex: number) {
    if (this.claiming || this.leaving || !this.draggedContent) return;
    
    const targetDesk = this.system.getState().desks[targetDeskIndex];
    if (!targetDesk || !targetDesk.unlocked) return;
    
    if (this.draggedContent.source === 'inbox') {
      const itemId = this.draggedContent.content.id;
      if (targetDesk.occupied) {
        if (this.system.mergeItemFromInbox(itemId, targetDeskIndex)) {
          this.showMergeAnimation(targetDeskIndex);
        }
      } else {
        this.system.placeItemOnDesk(itemId, targetDeskIndex);
      }
    } else {
      // Move/merge from desk to desk
      const sourceDeskIndex = this.draggedContent.index;
      if (sourceDeskIndex === targetDeskIndex) return;
      
      if (targetDesk.occupied) {
        // Try merge
        const success = this.system.mergeItems(targetDeskIndex, sourceDeskIndex);
        if (success) {
          this.showMergeAnimation(targetDeskIndex);
        }
      } else {
        // Move
        targetDesk.content = this.draggedContent.content;
        targetDesk.occupied = true;
        const sourceDesk = this.system.getState().desks[sourceDeskIndex];
        sourceDesk.content = null;
        sourceDesk.occupied = false;
      }
    }
    
    this.rewardMessage = '';
    this.updateUI();
  }

  private showMergeAnimation(deskIndex: number) {
    const container = this.deskGraphics.get(deskIndex);
    if (!container) return;
    
    const content = this.system.getState().desks[deskIndex].content;
    const title = content && 'producedCoins' in content ? '搭子来上班啦！' : '合成升级！';
    const burst = this.add.text(container.x, container.y - 60, title, { fontFamily: FONT_FAMILY, fontSize: '26px', color: '#62834e', backgroundColor: '#fff9e7', padding: { x: 12, y: 6 } }).setOrigin(0.5).setDepth(100);
    this.tweens.add({ targets: burst, y: burst.y - 45, alpha: 0, duration: 1000, onComplete: () => burst.destroy() });
    this.tweens.add({
      targets: container,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 150,
      yoyo: true,
      ease: 'Power2'
    });
  }

  private collectFromDesk(index: number) {
    if (this.claiming || this.leaving) return;
    const collected = this.system.collectCoins(index);
    if (collected > 0) {
      const desk = this.deskGraphics.get(index);
      if (desk) this.showCoinReward(desk.x, desk.y, collected);
      this.updateUI();
    }
  }

  private showCoinReward(x: number, y: number, amount: number) {
    const coin = officeProp(this, x, y, 7, 45).setDepth(200);
    const label = this.add.text(x + 28, y, `+${amount}`, { fontFamily: FONT_FAMILY, fontSize: '28px', color: '#99712c', fontStyle: 'bold' }).setDepth(200);
    this.tweens.add({ targets: [coin, label], y: y - 70, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => { coin.destroy(); label.destroy(); } });
  }

  private unlockNextDesk() {
    if (this.claiming || this.leaving) return;
    const success = this.system.unlockDesk();
    if (success) {
      this.updateUI();
    }
  }

  private updateProduction() {
    if (this.claiming || this.leaving) return;
    this.system.update();
    this.renderDesks();
    this.updateCoinsDisplay();
    this.checkBossInspection();
  }

  private checkBossInspection() {
    const state = this.system.getState();
    
    if (state.bossInspection && !state.bossInspection.handled && !this.bossInspectionUI) {
      this.showBossInspection();
    } else if (!state.bossInspection && this.bossInspectionUI) {
      this.bossInspectionUI.destroy();
      this.bossInspectionUI = undefined;
    }
  }

  private showBossInspection() {
    const container = this.add.container(360, 500).setDepth(100);
    
    const bg = this.add.rectangle(0, 0, 500, 200, 0xfff9e7, 1)
      .setStrokeStyle(4, 0x785d42);
    
    const title = this.add.text(0, -50, '老板巡查！', {
      fontFamily: FONT_FAMILY,
      fontSize: '32px',
      color: ink,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    const hint = this.add.text(0, 0, '快速点击应对', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: ink
    }).setOrigin(0.5);
    
    const btn = this.add.text(0, 50, '应对', {
      fontFamily: FONT_FAMILY,
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#d9534f',
      padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    btn.on('pointerdown', () => {
      if (this.claiming || this.leaving) return;
      const success = this.system.handleBossInspection();
      if (success) {
        container.destroy();
        this.bossInspectionUI = undefined;
        this.updateUI();
      }
    });
    
    container.add([bg, title, hint, btn]);
    this.bossInspectionUI = container;
  }

  private updateUI() {
    this.renderDesks();
    this.renderInbox();
    this.updateCoinsDisplay();
    this.updateGrowth();
    this.updateRewards();
    this.createButtons();
    void this.saveWorkstation();
  }

  private updateCoinsDisplay() {
    const state = this.system.getState();
    this.coinsText.setText(`麻薯币: ${state.coins}`);
  }

  shutdown() {
    this.lifecycle++;
    this.input.off('pointermove', this.onPointerMove, this);
    this.input.off('pointerup', this.onPointerUp, this);
    this.input.off('pointerupoutside', this.cancelDrag, this);
    this.game.events.off(Phaser.Core.Events.BLUR, this.cancelDrag, this);
    this.cancelDrag();
    if (this.loaded) void this.manager.save().catch(() => undefined);
    this.loaded = false;
  }
}
