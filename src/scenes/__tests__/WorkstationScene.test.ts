import { beforeEach, describe, expect, it, vi } from 'vitest';
import EventEmitter from 'eventemitter3';
import type Phaser from 'phaser';
import { WorkstationScene } from '../WorkstationScene';
import { HomeScene } from '../HomeScene';
import { WorkstationManager } from '../../core/WorkstationManager';
import { GameController } from '../../core/GameController';
import { WebPlatform } from '../../platform/WebPlatform';
import { setPlatform } from '../../platform';
import { setupHiDpi } from '../../ui/hidpi';
import ballLevels from '../../config/ballLevels.json';
import levelConfigs from '../../config/levelConfig.json';
import gameConfig from '../../config/gameConfig.json';

vi.mock('phaser', () => ({ default: {
  Scene: class {},
  Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  Core: { Events: { BLUR: 'blur' } }
} }));
vi.mock('../../ui/hidpi', () => ({ setupHiDpi: vi.fn() }));
vi.mock('../../ui/theme', async importOriginal => ({
  ...await importOriginal<typeof import('../../ui/theme')>(),
  paper: vi.fn()
}));

describe('workstation input lifecycle', () => {
  let scene: WorkstationScene;
  let controller: GameController;
  let input: EventEmitter;
  let events: EventEmitter;
  let gameEvents: EventEmitter;

  beforeEach(async () => {
    localStorage.clear();
    WorkstationManager['instance'] = null;
    setPlatform(new WebPlatform());
    controller = new GameController(ballLevels, levelConfigs, gameConfig);
    scene = new WorkstationScene();
    scene.init({ gameController: controller, gameConfig });
    input = new EventEmitter();
    events = new EventEmitter();
    gameEvents = new EventEmitter();
    scene.input = input as unknown as Phaser.Input.InputPlugin;
    scene.events = events as unknown as Phaser.Events.EventEmitter;
    scene.game = { events: gameEvents } as unknown as Phaser.Game;
    scene.time = { addEvent: vi.fn() } as unknown as Phaser.Time.Clock;
    scene.cameras = { main: {
      getWorldPoint: (x: number, y: number) => ({ x: x / 2, y: (y - 100) / 2 })
    } } as unknown as Phaser.Cameras.Scene2D.CameraManager;
    scene['createHeader'] = vi.fn();
    scene['createTutorial'] = vi.fn();
    scene['createDesks'] = vi.fn();
    scene['createInbox'] = vi.fn();
    scene['createRewards'] = vi.fn();
    scene['createButtons'] = vi.fn();
    scene['updateUI'] = vi.fn();
    scene['showMergeAnimation'] = vi.fn();
    await scene.create();
  });

  function dragInboxItem() {
    const preview = { setPosition: vi.fn(), destroy: vi.fn() };
    const item = scene['system'].getState().inbox[0];
    scene['draggedContent'] = { source: 'inbox', index: 0, content: item };
    scene['dragPreview'] = preview as unknown as Phaser.GameObjects.Container;
    scene['deskGraphics'].set(0, { getBounds: () => ({ contains: (x: number, y: number) => x === 150 && y === 230 }) } as unknown as Phaser.GameObjects.Container);
    return preview;
  }

  it('initializes the high-DPI camera and drops outside the original inbox icon in world coordinates', () => {
    expect(setupHiDpi).toHaveBeenCalledWith(scene);
    const preview = dragInboxItem();
    input.emit('pointermove', { x: 300, y: 560 });
    expect(preview.setPosition).toHaveBeenCalledWith(150, 230);
    input.emit('pointerup', { x: 300, y: 560 });

    expect(scene['system'].getState().desks[0].content).toMatchObject({ type: 'document' });
    expect(scene['system'].getState().inbox).toHaveLength(2);
    expect(preview.destroy).toHaveBeenCalledOnce();
    expect(scene['draggedContent']).toBeNull();
  });

  it('keeps a click on an occupied desk unchanged and places a merge on the destination desk', () => {
    const system = scene['system'];
    system.placeItemOnDesk(system.getState().inbox[0].id, 0);
    system.placeItemOnDesk(system.getState().inbox[0].id, 1);
    const saved = system.serialize();
    scene['draggedContent'] = { source: 'desk', index: 0, content: system.getState().desks[0].content! };
    scene['handleDrop'](0);
    expect(system.serialize()).toBe(saved);
    scene['handleDrop'](1);
    expect(system.getState().desks[0].occupied).toBe(false);
    expect(system.getState().desks[1].content).toMatchObject({ type: 'document', level: 2 });
  });

  it.each(['pointerupoutside', 'blur'])('cancels a drag on %s without consuming the item', event => {
    const preview = dragInboxItem();
    const saved = scene['system'].serialize();
    if (event === 'blur') gameEvents.emit(event);
    else input.emit(event);
    expect(scene['system'].serialize()).toBe(saved);
    expect(preview.destroy).toHaveBeenCalledOnce();
    expect(scene['draggedContent']).toBeNull();
  });

  it('removes input listeners and saves on shutdown, then resets UI references on reentry', () => {
    dragInboxItem();
    const save = vi.spyOn(scene['manager'], 'save');
    events.emit('shutdown');
    expect(input.listenerCount('pointermove')).toBe(0);
    expect(input.listenerCount('pointerup')).toBe(0);
    expect(input.listenerCount('pointerupoutside')).toBe(0);
    expect(gameEvents.listenerCount('blur')).toBe(0);
    expect(save).toHaveBeenCalledOnce();
    scene.init({ gameController: controller, gameConfig });
    expect(scene['deskGraphics'].size).toBe(0);
    expect(scene['dragPreview']).toBeNull();
    expect(scene['bossInspectionUI']).toBeUndefined();
  });

  it('claims once during repeated clicks and opens the page containing new rewards', async () => {
    const system = scene['system'];
    for (let i = 0; i < 5; i++) system.addItemToInbox('document', 1);
    await scene['manager'].completeStage({ id: 'first', mode: 'classic', level: 1, score: 25, bestCombo: 1, shotsUsed: 1 });
    const claim = vi.spyOn(scene['manager'], 'claimStageRewards');
    const first = scene['claimRewards']();
    await scene['claimRewards']();
    await first;
    expect(claim).toHaveBeenCalledOnce();
    expect(scene['system'].getState().inbox).toHaveLength(10);
    expect(scene['inboxPage']).toBe(1);
    expect(scene['rewardMessage']).toContain('收下 2 件');
    expect(scene['claiming']).toBe(false);
  });

  it('retains pending rewards when the inbox is full and explains how to free space', async () => {
    const system = scene['system'];
    while (system.addItemToInbox('document', 1)) { /* 填满收件箱。 */ }
    await scene['manager'].completeStage({ id: 'full', mode: 'classic', level: 1, score: 25, bestCombo: 1, shotsUsed: 1 });
    await scene['claimRewards']();
    expect(system.getState().inbox).toHaveLength(20);
    expect(system.getState().journey?.pendingRewards[0].items).toHaveLength(2);
    expect(scene['rewardMessage']).toContain('余 2 件已保留');
  });

  it('does not update a later scene after an outstanding claim resolves', async () => {
    await scene['manager'].completeStage({ id: 'leave', mode: 'classic', level: 1, score: 25, bestCombo: 1, shotsUsed: 1 });
    let resolveClaim!: (result: { claimed: number; remaining: number }) => void;
    vi.spyOn(scene['manager'], 'claimStageRewards').mockReturnValue(new Promise(resolve => { resolveClaim = resolve; }));
    const pending = scene['claimRewards']();
    events.emit('shutdown');
    scene.init({ gameController: controller, gameConfig });
    resolveClaim({ claimed: 2, remaining: 0 });
    await pending;
    expect(scene['updateUI']).not.toHaveBeenCalled();
    expect(scene['rewardMessage']).toBe('');
    expect(scene['claiming']).toBe(false);
  });

  it('blocks asset changes and timed updates while a claim can still roll back', () => {
    dragInboxItem();
    const system = scene['system'];
    const snapshot = system.serialize();
    const collect = vi.spyOn(system, 'collectCoins');
    const unlock = vi.spyOn(system, 'unlockDesk');
    const update = vi.spyOn(system, 'update');
    scene['claiming'] = true;
    scene['handleDrop'](0);
    scene['collectFromDesk'](0);
    scene['unlockNextDesk']();
    scene['updateProduction']();
    expect(system.serialize()).toBe(snapshot);
    expect(collect).not.toHaveBeenCalled();
    expect(unlock).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('bounds inbox pages and cancels dragging before changing pages', () => {
    const system = scene['system'];
    for (let i = 0; i < 10; i++) system.addItemToInbox('document', 1);
    const render = vi.fn();
    scene['renderInbox'] = render;
    const preview = dragInboxItem();
    scene['changeInboxPage'](1);
    expect(scene['inboxPage']).toBe(1);
    expect(preview.destroy).toHaveBeenCalledOnce();
    scene['changeInboxPage'](8);
    expect(scene['inboxPage']).toBe(2);
    scene['changeInboxPage'](-8);
    expect(scene['inboxPage']).toBe(0);
    expect(render).toHaveBeenCalledTimes(3);
  });

  it('returns to the pending tactical choice without resetting the controller', async () => {
    controller.advanceLevel();
    const state = controller.getGameState();
    scene['returnTo'] = 'UpgradeScene';
    scene['afterimageMode'] = true;
    scene.scene = { start: vi.fn() } as unknown as Phaser.Scenes.ScenePlugin;
    await scene['leaveWorkstation']();
    await scene['leaveWorkstation']();
    expect(scene.scene.start).toHaveBeenCalledOnce();
    expect(scene.scene.start).toHaveBeenCalledWith('UpgradeScene', { gameController: controller, gameConfig, afterimageMode: true });
    expect(controller.getGameState()).toEqual(state);
  });

  it('keeps the player in the workstation when saving before departure fails', async () => {
    vi.spyOn(scene['manager'], 'save').mockRejectedValue(new Error('storage unavailable'));
    scene.scene = { start: vi.fn() } as unknown as Phaser.Scenes.ScenePlugin;
    await scene['leaveWorkstation']();
    expect(scene.scene.start).not.toHaveBeenCalled();
    expect(scene['saveFailed']).toBe(true);
    expect(scene['leaving']).toBe(false);
  });

  it('shows a recoverable load failure instead of drawing an empty new workstation', async () => {
    scene.init({ gameController: controller, gameConfig });
    vi.spyOn(scene['manager'], 'getSystem').mockRejectedValue(new Error('storage unavailable'));
    const failure = vi.fn();
    scene['showLoadFailure'] = failure;
    await scene.create();
    expect(failure).toHaveBeenCalledOnce();
    expect(scene['loaded']).toBe(false);
  });

  it('the primary inventory action merges the selected kind and preserves unrelated pairs', () => {
    const system = scene['system'];
    system.addItemToInbox('coffee', 1);
    system.addItemToInbox('coffee', 1);
    scene['selectedContent'] = { source: 'inbox', index: 3, content: system.getState().inbox[3] };
    scene['quickMerge']();
    expect(system.getState().desks[0].content).toMatchObject({ type: 'coffee', level: 2 });
    expect(system.getState().inbox.filter(item => item.type === 'document')).toHaveLength(2);
  });

  it('merges one inbox pair into a real empty desk with a single deliberate action', () => {
    scene['quickMerge']();
    expect(scene['system'].getState().inbox).toHaveLength(1);
    expect(scene['system'].getState().desks[0].content).toMatchObject({ type: 'document', level: 2 });
    expect(scene['system'].getState().totalMerges).toBe(1);
    scene['quickMerge']();
    expect(scene['system'].getState().totalMerges).toBe(1);
  });

  it('a tap selects without consuming material, then tapping an empty desk places it', () => {
    dragInboxItem();
    scene['dragStart'] = { x: 150, y: 230 };
    input.emit('pointerup', { x: 300, y: 560 });
    expect(scene['selectedContent']?.source).toBe('inbox');
    expect(scene['system'].getState().inbox).toHaveLength(3);
    scene['onDeskPointerDown'](1);
    expect(scene['system'].getState().desks[1].content).toMatchObject({ type: 'document', level: 1 });
    expect(scene['selectedContent']).toBeNull();
  });

  it('returns the selected material with its original identity and keeps it on the desk if full', () => {
    const system = scene['system'];
    const item = system.getState().inbox[0];
    system.placeItemOnDesk(item.id, 0);
    scene['selectedContent'] = { source: 'desk', index: 0, content: item };
    while (system.addItemToInbox('coffee', 1)) { /* 填满收件箱。 */ }
    scene['returnSelectedItem']();
    expect(system.getState().desks[0].content?.id).toBe(item.id);
    expect(scene['rewardMessage']).toContain('收件箱满');
    system.getState().inbox.pop();
    scene['returnSelectedItem']();
    expect(system.getState().desks[0].content).toBeNull();
    expect(system.getState().inbox[system.getState().inbox.length - 1]?.id).toBe(item.id);
  });

  it('never quick-merges or returns materials during a pending reward claim', () => {
    const snapshot = scene['system'].serialize();
    scene['claiming'] = true;
    scene['quickMerge']();
    scene['returnSelectedItem']();
    expect(scene['system'].serialize()).toBe(snapshot);
  });

  it('passes the game context into the workstation', () => {
    const home = new HomeScene();
    home.init({ gameController: controller, gameConfig });
    home.scene = { start: vi.fn() } as unknown as Phaser.Scenes.ScenePlugin;
    home['goToWorkstation']();
    expect(home.scene.start).toHaveBeenCalledWith('WorkstationScene', { gameController: controller, gameConfig });
  });
});
