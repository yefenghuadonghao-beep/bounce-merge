import Phaser from 'phaser';
import { WorkstationManager } from '../core/WorkstationManager';
import { WorkstationSystem } from '../core/WorkstationSystem';
import type { GameController } from '../core/GameController';
import type { GameConfig } from '../types';
import type { WorkstationConfig, WorkstationItem, WorkstationEmployee, ItemType } from '../types/workstation';
import workstationConfig from '../config/workstationConfig.json';
import { getPlatform } from '../platform';
import { FONT_FAMILY, ink, panel, paper } from '../ui/theme';
import { loadOfficeArt, officeProp, itemFrames } from '../ui/officeArt';
import { setupHiDpi } from '../ui/hidpi';

export class WorkstationScene extends Phaser.Scene {
  private system!: WorkstationSystem;
  private config!: WorkstationConfig;
  private manager!: WorkstationManager;
  private platform = getPlatform();
  private gameController!: GameController;
  private gameConfig!: GameConfig;
  
  private deskGraphics: Map<number, Phaser.GameObjects.Container> = new Map();
  private inboxGraphics: Phaser.GameObjects.Container[] = [];
  private inboxOverflowText?: Phaser.GameObjects.Text;
  private collectAllButton?: Phaser.GameObjects.Text;
  private coinsText!: Phaser.GameObjects.Text;
  private unlockButton?: Phaser.GameObjects.Container;
  private bossInspectionUI?: Phaser.GameObjects.Container;
  
  private draggedContent: { source: 'inbox' | 'desk'; index: number; content: WorkstationItem | WorkstationEmployee } | null = null;
  private dragPreview: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'WorkstationScene' });
  }

  init(data: { gameController: GameController; gameConfig: GameConfig }) {
    this.gameController = data.gameController;
    this.gameConfig = data.gameConfig;
    this.deskGraphics.clear();
    this.inboxGraphics = [];
    this.inboxOverflowText = undefined;
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
    this.system = await this.manager.getSystem();
    
    paper(this);
    this.createHeader();
    this.createTutorial();
    this.createDesks();
    this.createInbox();
    this.createButtons();
    
    // Auto-save every 5 seconds
    this.time.addEvent({
      delay: 5000,
      callback: () => this.manager.save(),
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

  private createHeader() {
    this.add.image(360, 550, 'office-room').setDisplaySize(720, 1080).setAlpha(0.18);
    panel(this, 28, 145, 664, 820, 0xf1ead8);
    this.add.text(360, 940, '把同款放一起，让工位慢慢热闹起来', { fontFamily: FONT_FAMILY, fontSize: '19px', color: '#8b7c64' }).setOrigin(0.5);
    this.add.text(360, 40, '我的下班事务所', {
      fontFamily: FONT_FAMILY,
      fontSize: '36px',
      color: ink,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Back button
    const backBtn = this.add.text(50, 40, '← 返回', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: ink
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    
    backBtn.on('pointerdown', async () => {
      await this.manager.save();
      this.scene.start('HomeScene', {
        gameController: this.gameController,
        gameConfig: this.gameConfig
      });
    });
    
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
    this.add.text(360, 120, '拖入工位 → 同款合并 → 招募团子员工', {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: '#8b7c64'
    }).setOrigin(0.5);
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
    const startY = 140;
    const spacing = 200;
    const slotWidth = 180;
    const slotHeight = 180;
    
    for (let i = 0; i < state.desks.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = startX + col * spacing + slotWidth / 2;
      const y = startY + row * spacing + slotHeight / 2;
      
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
        const lockText = officeProp(this, 0, -12, 0, 148).setAlpha(0.25);

        const costIndex = i - this.config.initialDesks;
        const cost = this.config.deskUnlockCost[costIndex];
        if (cost) {
          const costText = this.add.text(0, 64, `待布置 · ${cost}币`, {
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
        container.add(officeProp(this, 0, 2, 0, 174));
        container.add(this.add.text(-76, -73, String(i + 1).padStart(2, '0'), { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#9b8e75' }));
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
    const icon = officeProp(this, 22, -3, itemFrames[item.type], 90);
    const label = this.add.text(0, 66, `${this.itemName(item.type)} · ${item.level}级`, { fontFamily: FONT_FAMILY, fontSize: '18px', color: ink, backgroundColor: '#fff8e5', padding: { x: 8, y: 3 } }).setOrigin(0.5);
    container.add([icon, label]);
  }

  private itemName(type: ItemType) {
    return { document: '文件', coffee: '咖啡', package: '快递', keyboard: '键盘', mouse: '鼠标', plant: '绿植' }[type];
  }

  private renderEmployee(container: Phaser.GameObjects.Container, employee: WorkstationEmployee, deskIndex: number) {
    const face = { intern: 1, junior: 4, senior: 5, lead: 7, manager: 10 }[employee.type];
    const icon = this.add.image(30, -23, 'characters', `ball_${face}`).setDisplaySize(82, 82);
    this.tweens.add({ targets: icon, y: -29, angle: 4, duration: 1400 + deskIndex * 100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const coins = this.add.text(0, 45, `${Math.floor(employee.producedCoins)}币`, { fontFamily: FONT_FAMILY, fontSize: '19px', color: '#816227', backgroundColor: '#fff3cd', padding: { x: 12, y: 4 } }).setOrigin(0.5).setName('income').setInteractive({ useHandCursor: true });
    coins.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.collectFromDesk(deskIndex);
    });
    container.add([icon, coins]);
  }

  private createInbox() {
    this.add.text(360, 1000, '今日快递 · 拖到桌面拆开惊喜', {
      fontFamily: FONT_FAMILY,
      fontSize: '22px',
      color: ink,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    panel(this, 40, 1030, 640, 200);
    this.renderInbox();
  }

  private renderInbox() {
    this.inboxOverflowText?.destroy();
    this.inboxOverflowText = undefined;
    this.inboxGraphics.forEach(g => g.destroy());
    this.inboxGraphics = [];
    
    const state = this.system.getState();
    const startX = 90;
    const startY = 1070;
    const spacing = 100;
    
    for (let i = 0; i < Math.min(state.inbox.length, 6); i++) {
      const item = state.inbox[i];
      const x = startX + (i % 6) * spacing;
      const y = startY + Math.floor(i / 6) * 85;
      
      const container = this.add.container(x, y);
      
      const bg = this.add.rectangle(0, 0, 84, 100, 0xf3ead4).setStrokeStyle(1, 0xd7c9ab).setInteractive({ useHandCursor: true });
      const icon = officeProp(this, 0, -6, itemFrames[item.type], 76);
      const levelText = this.add.text(0, 38, `${item.level}级`, { fontFamily: FONT_FAMILY, fontSize: '16px', color: ink }).setOrigin(0.5);
      container.add([bg, icon, levelText]);
      this.inboxGraphics.push(container);

      bg.on('pointerdown', () => this.startDragFromInbox(i, item));
    }
    
    if (state.inbox.length > 6) {
      this.inboxOverflowText = this.add.text(650, 1130, `+${state.inbox.length - 6}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: ink
      }).setOrigin(1, 0.5);
    }
  }

  private startDragFromInbox(index: number, item: WorkstationItem) {
    this.draggedContent = { source: 'inbox', index, content: item };
    this.createDragPreview(item);
  }

  private onDeskPointerDown(deskIndex: number) {
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
    if (!this.draggedContent) return;
    
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
    
    this.updateUI();
  }

  private showMergeAnimation(deskIndex: number) {
    const container = this.deskGraphics.get(deskIndex);
    if (!container) return;
    
    const burst = this.add.text(container.x, container.y - 60, '合成升级！', { fontFamily: FONT_FAMILY, fontSize: '26px', color: '#62834e', backgroundColor: '#fff9e7', padding: { x: 12, y: 6 } }).setOrigin(0.5).setDepth(100);
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
    const collected = this.system.collectCoins(index);
    if (collected > 0) {
      const desk = this.deskGraphics.get(index);
      if (desk) this.showCoinReward(desk.x, desk.y, collected);
      this.renderDesks();
      this.updateCoinsDisplay();
    }
  }

  private showCoinReward(x: number, y: number, amount: number) {
    const coin = officeProp(this, x, y, 7, 45).setDepth(200);
    const label = this.add.text(x + 28, y, `+${amount}`, { fontFamily: FONT_FAMILY, fontSize: '28px', color: '#99712c', fontStyle: 'bold' }).setDepth(200);
    this.tweens.add({ targets: [coin, label], y: y - 70, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => { coin.destroy(); label.destroy(); } });
  }

  private unlockNextDesk() {
    const success = this.system.unlockDesk();
    if (success) {
      this.updateUI();
    }
  }

  private updateProduction() {
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
      const success = this.system.handleBossInspection();
      if (success) {
        container.destroy();
        this.bossInspectionUI = undefined;
        this.updateCoinsDisplay();
      }
    });
    
    container.add([bg, title, hint, btn]);
    this.bossInspectionUI = container;
  }

  private updateUI() {
    this.renderDesks();
    this.renderInbox();
    this.updateCoinsDisplay();
    
    this.createButtons();
  }

  private updateCoinsDisplay() {
    const state = this.system.getState();
    this.coinsText.setText(`麻薯币: ${state.coins}`);
  }

  shutdown() {
    this.input.off('pointermove', this.onPointerMove, this);
    this.input.off('pointerup', this.onPointerUp, this);
    this.input.off('pointerupoutside', this.cancelDrag, this);
    this.game.events.off(Phaser.Core.Events.BLUR, this.cancelDrag, this);
    this.cancelDrag();
    void this.manager.save();
  }
}
