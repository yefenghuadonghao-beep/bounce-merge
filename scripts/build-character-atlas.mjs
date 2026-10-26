// 从 AI 原图生成运行时图集：按角色透明边界紧裁、统一缩小、调色板压缩。
// 用法：node scripts/build-character-atlas.mjs
// 原图：art/characters/office-mochi-source.png（5×2 等距网格，透明背景，不进入构建产物）
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const SOURCE = 'art/characters/office-mochi-source.png';
const OUT_PNG = 'assets/characters/office-mochi.png';
const OUT_JSON = 'src/config/characterAtlas.json';
const COLUMNS = 5;
const ROWS = 2;
const CELL = 256; // 最大显示约 190px（通关角色），留余量
const PAD = 2; // 帧间透明间隔，防止线性过滤串色
const ALPHA = 40;

const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const frames = {};
const composites = [];

for (let i = 0; i < COLUMNS * ROWS; i++) {
  const column = i % COLUMNS;
  const row = Math.floor(i / COLUMNS);
  const x0 = Math.round(column * info.width / COLUMNS);
  const x1 = Math.round((column + 1) * info.width / COLUMNS);
  const y0 = Math.round(row * info.height / ROWS);
  const y1 = Math.round((row + 1) * info.height / ROWS);
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (data[(y * info.width + x) * 4 + 3] > ALPHA) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error(`cell ${i + 1} is empty`);
  // 正方形帧：左右贴合角色宽度，底边贴合角色底部，使圆形碰撞体与可见轮廓的左右和底部对齐。
  const side = Math.max(maxX - minX + 1, maxY - minY + 1);
  const left = Math.round((minX + maxX + 1) / 2 - side / 2);
  const top = maxY + 1 - side;
  // 只截取角色主体本身，再用透明像素补成正方形，避免把相邻单元格的内容带进来。
  const extract = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  // sharp 在同一管线里会先 resize 再 extend，所以补边和缩放必须分两步。
  const padded = await sharp(SOURCE)
    .ensureAlpha()
    .extract(extract)
    .extend({
      left: minX - left,
      top: minY - top,
      right: left + side - (maxX + 1),
      bottom: top + side - (maxY + 1),
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
  const square = await sharp(padded)
    .resize(CELL, CELL, { kernel: 'lanczos3' })
    .png()
    .toBuffer();
  const fx = PAD + column * (CELL + PAD * 2);
  const fy = PAD + row * (CELL + PAD * 2);
  composites.push({ input: square, left: fx, top: fy });
  frames[`ball_${i + 1}`] = { frame: { x: fx, y: fy, w: CELL, h: CELL } };
}

const width = COLUMNS * (CELL + PAD * 2);
const height = ROWS * (CELL + PAD * 2);
await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(composites)
  .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 })
  .toFile(OUT_PNG);
writeFileSync(OUT_JSON, JSON.stringify({ frames, meta: { image: 'office-mochi.png', size: { w: width, h: height }, scale: '1' } }, null, 2) + '\n');
console.log(`wrote ${OUT_PNG} ${width}x${height} and ${OUT_JSON}`);
