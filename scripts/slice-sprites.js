#!/usr/bin/env node

/**
 * Sprite Sheet Slicer v2
 * 
 * Properly centers each fruit sprite by detecting its alpha bbox,
 * extracting the content, and centering it in a square canvas.
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INPUT_SHEET = join(__dirname, '../art/balls_sheet.jpg');
const OUTPUT_DIR = join(__dirname, '../assets/sprites');
const OUTPUT_SIZE = 256; // 256x256 for sharper rendering

const GRID_COLS = 5;
const GRID_ROWS = 2;
const SHEET_WIDTH = 1280;
const SHEET_HEIGHT = 720;

const CELL_WIDTH = SHEET_WIDTH / GRID_COLS;  // 256
const CELL_HEIGHT = SHEET_HEIGHT / GRID_ROWS; // 360

const BALL_NAMES = [
  'blueberry', 'cherry', 'strawberry', 'lime', 'orange',
  'peach', 'apple', 'coconut', 'watermelon', 'star'
];

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function sliceSprite(index) {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  const name = BALL_NAMES[index];
  const level = index + 1;
  
  const cellX = Math.floor(col * CELL_WIDTH);
  const cellY = Math.floor(row * CELL_HEIGHT);
  
  console.log(`Processing Level ${level} (${name}): [${col}, ${row}] at (${cellX}, ${cellY})`);
  
  try {
    const outputPath = join(OUTPUT_DIR, `ball_${level}_${name}.png`);
    
    // Extract with wider search window to avoid edge cropping
    const searchPadding = 40;
    const searchX = Math.max(0, cellX - searchPadding);
    const searchY = Math.max(0, cellY - searchPadding);
    const searchWidth = Math.min(SHEET_WIDTH - searchX, Math.floor(CELL_WIDTH) + searchPadding * 2);
    const searchHeight = Math.min(SHEET_HEIGHT - searchY, Math.floor(CELL_HEIGHT) + searchPadding * 2);
    
    const { data: rawData, info: rawInfo } = await sharp(INPUT_SHEET)
      .extract({ left: searchX, top: searchY, width: searchWidth, height: searchHeight })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const width = rawInfo.width;
    const height = rawInfo.height;
    const channels = 4;
    const pixels = Buffer.alloc(width * height * channels);
    
    // Copy RGB and initialize alpha
    for (let i = 0; i < width * height; i++) {
      pixels[i * 4] = rawData[i * rawInfo.channels];
      pixels[i * 4 + 1] = rawData[i * rawInfo.channels + 1];
      pixels[i * 4 + 2] = rawData[i * rawInfo.channels + 2];
      pixels[i * 4 + 3] = 255;
    }
    
    // Flood fill from edges to identify background
    const visited = new Uint8Array(width * height);
    const queue = [];
    const WHITE_THRESHOLD = 228;
    
    const isWhiteish = (x, y) => {
      const idx = (y * width + x) * 4;
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
      return r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD &&
             Math.abs(r - g) < 20 && Math.abs(g - b) < 20;
    };
    
    const markBackground = (x, y) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const pixelIdx = y * width + x;
      if (visited[pixelIdx] || !isWhiteish(x, y)) return;
      visited[pixelIdx] = 1;
      queue.push([x, y]);
    };
    
    // Flood fill from edges
    for (let x = 0; x < width; x++) {
      markBackground(x, 0);
      markBackground(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      markBackground(0, y);
      markBackground(width - 1, y);
    }
    
    while (queue.length > 0) {
      const [x, y] = queue.shift();
      markBackground(x - 1, y);
      markBackground(x + 1, y);
      markBackground(x, y - 1);
      markBackground(x, y + 1);
    }
    
    // Find alpha bounding box of content
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!visited[y * width + x]) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    console.log(`  Alpha bbox: (${minX},${minY},${maxX},${maxY}) = ${maxX - minX}x${maxY - minY}px`);
    
    // Set alpha channel based on flood fill
    for (let i = 0; i < width * height; i++) {
      if (visited[i]) pixels[i * 4 + 3] = 0;
    }
    
    // Extract content and center in square canvas
    const contentWidth = maxX - minX + 1;
    const contentHeight = maxY - minY + 1;
    const contentSize = Math.max(contentWidth, contentHeight);
    const padding = Math.ceil(contentSize * 0.04); // 4% padding
    const canvasSize = contentSize + padding * 2;
    
    console.log(`  Canvas: ${canvasSize}x${canvasSize} (content ${contentWidth}x${contentHeight})`);
    
    const contentBuffer = await sharp(pixels, { raw: { width, height, channels: 4 } })
      .extract({ left: minX, top: minY, width: contentWidth, height: contentHeight })
      .png()
      .toBuffer();
    
    const offsetX = Math.floor((canvasSize - contentWidth) / 2);
    const offsetY = Math.floor((canvasSize - contentHeight) / 2);
    
    const squareCanvas = await sharp(contentBuffer)
      .extend({
        top: offsetY,
        bottom: canvasSize - contentHeight - offsetY,
        left: offsetX,
        right: canvasSize - contentWidth - offsetX,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .toBuffer();
    
    const canvasInfo = await sharp(squareCanvas).metadata();
    console.log(`  Extended canvas: ${canvasInfo.width}x${canvasInfo.height}`);
    
    await sharp(squareCanvas)
      .resize({
        width: OUTPUT_SIZE,
        height: OUTPUT_SIZE,
        fit: 'fill',
        kernel: 'lanczos3'
      })
      .png({ compressionLevel: 9 })
      .toFile(outputPath);
    
    const stats = await fs.stat(outputPath);
    console.log(`  ✓ Saved: ${(stats.size / 1024).toFixed(1)} KB\n`);
    
  } catch (err) {
    console.error(`  ✗ Failed:`, err.message);
    throw err;
  }
}

async function optimizeBackground() {
  const inputPath = join(__dirname, '../art/background.jpg');
  const outputPath = join(__dirname, '../assets/background.jpg');
  
  console.log('Optimizing background image...');
  
  await sharp(inputPath)
    .resize(720, 1280, { fit: 'cover' })
    .jpeg({ quality: 85, progressive: true })
    .toFile(outputPath);
  
  const stats = await fs.stat(outputPath);
  console.log(`✓ Background optimized: ${(stats.size / 1024).toFixed(1)} KB\n`);
}

async function main() {
  console.log('🎨 Sprite Sheet Slicer v2\n');
  console.log(`Input: ${INPUT_SHEET}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Grid: ${GRID_COLS}x${GRID_ROWS}, Cell: ${CELL_WIDTH}x${CELL_HEIGHT}`);
  console.log(`Output size: ${OUTPUT_SIZE}x${OUTPUT_SIZE}\n`);
  
  await ensureDir(OUTPUT_DIR);
  
  for (let i = 0; i < BALL_NAMES.length; i++) {
    await sliceSprite(i);
  }
  
  await optimizeBackground();
  
  console.log('✅ All sprites generated successfully!');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
