import Phaser from 'phaser';

// 高清渲染：画布按 renderScale 放大，主相机同倍缩放并对准设计分辨率中心，
// 场景代码继续使用 720×1280 坐标；文字纹理按同一倍率栅格化，避免被放大后发糊。
let renderScale = 1;
const DESIGN_CENTER = { x: 360, y: 640 };

export function setRenderScale(scale: number): void {
  renderScale = scale;
}

export function getRenderScale(): number {
  return renderScale;
}

/** 在每个场景 create() 开头调用；指针请用 worldX/worldY（已换算回设计坐标）。 */
export function setupHiDpi(scene: Phaser.Scene): void {
  const camera = scene.cameras.main;
  camera.setZoom(renderScale);
  camera.centerOn(DESIGN_CENTER.x, DESIGN_CENTER.y);
  if (renderScale === 1) return;
  const onAdded = (gameObject: Phaser.GameObjects.GameObject) => {
    if (gameObject instanceof Phaser.GameObjects.Text) gameObject.setResolution(renderScale);
  };
  scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded));
}
