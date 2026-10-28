import Phaser from 'phaser';
import { WorkstationManager } from '../core/WorkstationManager';
import { WorkstationSystem } from '../core/WorkstationSystem';
import type { WorkstationConfig, WorkstationItem, WorkstationEmployee, ItemType } from '../types/workstation';
import workstationConfig from '../config/workstationConfig.json';
import { getPlatform } from '../platform';
import { FONT_FAMILY, ink, panel, paper } from '../ui/theme';

export class WorkstationScene extends Phaser.Scene {
  private system!: WorkstationSystem;
  private config!: WorkstationConfig;
  private manager!: WorkstationManager;
  private platform = getPlatform();
  
  private deskGraphics: Map<number, Phaser.GameObjects.Container> = new Map();
  private inboxGraphics: Phaser.GameObjects.Container[] = [];
  private coinsText!: Phaser.GameObjects.Text;
  private unlockButton?: Phaser.GameObjects.Container;
  private bossInspectionUI?: Phaser.GameObjects.Container;
  
  private draggedContent: { source: 'inbox' | 'desk'; index: number; content: WorkstationItem | WorkstationEmployee } | null = null;
  private dragPreview: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'WorkstationScene' });
  }

  async create() {
    this.config = workstationConfig as WorkstationConfig;
    this.manager = WorkstationManager.getInstance(this.platform);
    this.system = await this.manager.getSystem();
    
    paper(this);
    this.createHeader();
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
  }

  private createHeader() {
    this.add.text(360, 40, '工位麻薯', {
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
      this.scene.start('HomeScene');
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

  private createButtons() {
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
    
    collectAllBtn.on('pointerdown', () => {
      const collected = this.system.collectAllCoins();
      if (collected > 0) {
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
      const bgColor = desk.unlocked ? 0xf5ecd7 : 0xd5cbb9;
      const bg = this.add.rectangle(0, 0, slotWidth, slotHeight, bgColor, 1)
        .setStrokeStyle(3, 0x8b7c64);
      container.add(bg);
      
      if (desk.unlocked) {
        bg.setInteractive({ useHandCursor: true, dropZone: true });
        bg.on('pointerdown', () => this.onDeskPointerDown(i));
      } else {
        // Show lock and cost
        const lockText = this.add.text(0, -20, '锁', {
          fontFamily: FONT_FAMILY,
          fontSize: '32px',
          color: '#8b7c64',
          fontStyle: 'bold'
        }).setOrigin(0.5);
        
        const costIndex = i - this.config.initialDesks;
        const cost = this.config.deskUnlockCost[costIndex];
        if (cost) {
          const costText = this.add.text(0, 20, `${cost}币`, {
            fontFamily: FONT_FAMILY,
            fontSize: '16px',
            color: '#8b7c64'
          }).setOrigin(0.5);
          container.add(costText);
        }
        
        container.add(lockText);
      }
      
      this.deskGraphics.set(i, container);
    }
    
    this.renderDesks();
  }

  private renderDesks() {
    const state = this.system.getState();
    
    for (let i = 0; i < state.desks.length; i++) {
      const container = this.deskGraphics.get(i);
      if (!container) continue;
      
      // Remove old content (keep background and lock)
      while (container.length > (state.desks[i].unlocked ? 1 : 3)) {
        container.remove(container.list[state.desks[i].unlocked ? 1 : 3], true);
      }
      
      const desk = state.desks[i];
      if (desk.occupied && desk.content) {
        if ('producedCoins' in desk.content) {
          this.renderEmployee(container, desk.content as WorkstationEmployee, i);
        } else {
          this.renderItem(container, desk.content as WorkstationItem);
        }
      }
    }
  }

  private renderItem(container: Phaser.GameObjects.Container, item: WorkstationItem, dragging = false) {
    const colorMap: Record<ItemType, number> = {
      document: 0xffd4a3,
      coffee: 0xd4a574,
      package: 0xadd8e6,
      keyboard: 0xc8c8c8,
      mouse: 0xe0e0e0,
      plant: 0x9acd32
    };
    
    const labelMap: Record<ItemType, string> = {
      document: '文件',
      coffee: '咖啡',
      package: '快递',
      keyboard: '键盘',
      mouse: '鼠标',
      plant: '绿植'
    };
    
    const icon = this.add.rectangle(0, -15, 80, 60, colorMap[item.type] || 0xcccccc)
      .setStrokeStyle(2, 0x785d42);
    
    const label = this.add.text(0, -15, labelMap[item.type] || item.type, {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: ink,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    const levelText = this.add.text(0, 25, `Lv.${item.level}`, {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: ink
    }).setOrigin(0.5);
    
    container.add([icon, label, levelText]);
  }

  private renderEmployee(container: Phaser.GameObjects.Container, employee: WorkstationEmployee, deskIndex: number) {
    const names: Record<string, string> = {
      intern: '实习生',
      junior: '初级',
      senior: '高级',
      lead: '主管',
      manager: '经理'
    };
    
    const colors: Record<string, number> = {
      intern: 0xffe4b5,
      junior: 0xffd4a3,
      senior: 0xffb6c1,
      lead: 0xdda0dd,
      manager: 0xff69b4
    };
    
    const icon = this.add.rectangle(0, -25, 90, 50, colors[employee.type] || 0xffb6c1)
      .setStrokeStyle(2, 0x785d42);
    
    const nameText = this.add.text(0, -25, names[employee.type] || employee.type, {
      fontFamily: FONT_FAMILY,
      fontSize: '16px',
      color: ink,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    const coinsText = this.add.text(0, 8, `${Math.floor(employee.producedCoins)}币`, {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: '#d4af37'
    }).setOrigin(0.5);
    
    const collectBtn = this.add.text(0, 32, '收取', {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#4a9d5f',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    collectBtn.on('pointerdown', (event: Phaser.Input.Pointer) => {
      event.event.stopPropagation();
      this.collectFromDesk(deskIndex);
    });
    
    container.add([icon, nameText, coinsText, collectBtn]);
  }

  private createInbox() {
    this.add.text(360, 1000, '收件箱', {
      fontFamily: FONT_FAMILY,
      fontSize: '22px',
      color: ink,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    panel(this, 40, 1030, 640, 200);
    this.renderInbox();
  }

  private renderInbox() {
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
      
      const colorMap: Record<ItemType, number> = {
        document: 0xffd4a3,
        coffee: 0xd4a574,
        package: 0xadd8e6,
        keyboard: 0xc8c8c8,
        mouse: 0xe0e0e0,
        plant: 0x9acd32
      };
      
      const labelMap: Record<ItemType, string> = {
        document: '文',
        coffee: '咖',
        package: '递',
        keyboard: '键',
        mouse: '鼠',
        plant: '植'
      };
      
      const bg = this.add.rectangle(0, 0, 70, 60, colorMap[item.type] || 0xcccccc, 1)
        .setStrokeStyle(2, 0x785d42)
        .setInteractive({ useHandCursor: true, draggable: true });
      
      const label = this.add.text(0, -5, labelMap[item.type] || '?', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: ink,
        fontStyle: 'bold'
      }).setOrigin(0.5);
      
      const levelText = this.add.text(0, 15, `${item.level}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: ink
      }).setOrigin(0.5);
      
      container.add([bg, label, levelText]);
      this.inboxGraphics.push(container);
      
      bg.on('pointerdown', () => this.startDragFromInbox(i, item));
    }
    
    if (state.inbox.length > 6) {
      this.add.text(650, 1130, `+${state.inbox.length - 6}`, {
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
    
    const container = this.add.container(this.input.activePointer.x, this.input.activePointer.y);
    container.setDepth(1000);
    container.setAlpha(0.8);
    
    if ('producedCoins' in content) {
      const employee = content as WorkstationEmployee;
      const names: Record<string, string> = {
        intern: '实习生',
        junior: '初级',
        senior: '高级',
        lead: '主管',
        manager: '经理'
      };
      const colors: Record<string, number> = {
        intern: 0xffe4b5,
        junior: 0xffd4a3,
        senior: 0xffb6c1,
        lead: 0xdda0dd,
        manager: 0xff69b4
      };
      
      const icon = this.add.rectangle(0, 0, 90, 50, colors[employee.type] || 0xffb6c1)
        .setStrokeStyle(2, 0x785d42);
      const nameText = this.add.text(0, 0, names[employee.type] || employee.type, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: ink,
        fontStyle: 'bold'
      }).setOrigin(0.5);
      container.add([icon, nameText]);
    } else {
      const item = content as WorkstationItem;
      const colorMap: Record<ItemType, number> = {
        document: 0xffd4a3,
        coffee: 0xd4a574,
        package: 0xadd8e6,
        keyboard: 0xc8c8c8,
        mouse: 0xe0e0e0,
        plant: 0x9acd32
      };
      const labelMap: Record<ItemType, string> = {
        document: '文',
        coffee: '咖',
        package: '递',
        keyboard: '键',
        mouse: '鼠',
        plant: '植'
      };
      
      const icon = this.add.rectangle(0, 0, 70, 60, colorMap[item.type] || 0xcccccc)
        .setStrokeStyle(2, 0x785d42);
      const label = this.add.text(0, 0, labelMap[item.type] || '?', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: ink,
        fontStyle: 'bold'
      }).setOrigin(0.5);
      container.add([icon, label]);
    }
    
    this.dragPreview = container;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (this.dragPreview) {
      this.dragPreview.setPosition(pointer.x, pointer.y);
    }
  }

  private onPointerUp() {
    if (!this.draggedContent || !this.dragPreview) return;
    
    const pointer = this.input.activePointer;
    let droppedOnDesk = -1;
    
    // Check which desk we're over
    for (const [index, container] of this.deskGraphics) {
      const bounds = container.getBounds();
      if (bounds.contains(pointer.x, pointer.y)) {
        droppedOnDesk = index;
        break;
      }
    }
    
    if (droppedOnDesk !== -1) {
      this.handleDrop(droppedOnDesk);
    }
    
    if (this.dragPreview) {
      this.dragPreview.destroy();
      this.dragPreview = null;
    }
    this.draggedContent = null;
  }

  private handleDrop(targetDeskIndex: number) {
    if (!this.draggedContent) return;
    
    const targetDesk = this.system.getState().desks[targetDeskIndex];
    if (!targetDesk || !targetDesk.unlocked) return;
    
    if (this.draggedContent.source === 'inbox') {
      // Place from inbox
      if (targetDesk.occupied) {
        // Check for merge
        const draggedItem = this.draggedContent.content as WorkstationItem;
        const targetContent = targetDesk.content;
        
        if (targetContent && !('producedCoins' in targetContent)) {
          const targetItem = targetContent as WorkstationItem;
          if (draggedItem.type === targetItem.type && draggedItem.level === targetItem.level) {
            // Merge: remove from inbox, merge on desk
            const itemId = this.system.getState().inbox[this.draggedContent.index].id;
            const tempDeskIndex = this.system.getState().desks.findIndex(d => !d.unlocked || (!d.occupied && d.unlocked));
            if (tempDeskIndex !== -1) {
              this.system.placeItemOnDesk(itemId, tempDeskIndex);
              const success = this.system.mergeItems(tempDeskIndex, targetDeskIndex);
              if (success) {
                this.showMergeAnimation(targetDeskIndex);
              }
            }
          }
        }
      } else {
        const itemId = this.system.getState().inbox[this.draggedContent.index].id;
        this.system.placeItemOnDesk(itemId, targetDeskIndex);
      }
    } else {
      // Move/merge from desk to desk
      const sourceDeskIndex = this.draggedContent.index;
      if (sourceDeskIndex === targetDeskIndex) return;
      
      if (targetDesk.occupied) {
        // Try merge
        const success = this.system.mergeItems(sourceDeskIndex, targetDeskIndex);
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
      this.renderDesks();
      this.updateCoinsDisplay();
    }
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
    
    if (this.unlockButton) {
      this.unlockButton.destroy();
      this.unlockButton = undefined;
    }
    this.createButtons();
  }

  private updateCoinsDisplay() {
    const state = this.system.getState();
    this.coinsText.setText(`麻薯币: ${state.coins}`);
  }

  async shutdown() {
    await this.manager.save();
  }
}
