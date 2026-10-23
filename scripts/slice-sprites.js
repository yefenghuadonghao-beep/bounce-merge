#!/usr/bin/env node

/**
 * Sprite Sheet Slicer
 * 
 * Slices balls_sheet.jpg into individual transparent PNGs
 * Input: 1280x720 grid (5 columns x 2 rows) = 10 sprites
 * Output: 128x128 PNGs with transparent background
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INPUT_SHEET = join(__dirname, '../art/balls_sheet.jpg');
const OUTPUT_DIR = join(__dirname, '../assets/sprites');
const OUTPUT_SIZE = 128;

const GRID_COLS = 5;
const GRID_ROWS = 2;
const SHEET_WIDTH = 1280;
const SHEET_HEIGHT = 720;

const CELL_WIDTH = SHEET_WIDTH / GRID_COLS;  // 256
const CELL_HEIGHT = SHEET_HEIGHT / GRID_ROWS; // 360

// Ball names in reading order (left to right, top to bottom)
const BALL_NAMES = [
  'blueberry',   // Level 1
  'cherry',      // Level 2
  'strawberry',  // Level 3
  'lime',        // Level 4
  'orange',      // Level 5
  'peach',       // Level 6
  'apple',       // Level 7
  'coconut',     // Level 8
  'watermelon',  // Level 9
  'star'         // Level 10
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
  
  const x = Math.floor(col * CELL_WIDTH);
  const y = Math.floor(row * CELL_HEIGHT);
  
  console.log(`Processing Level ${level} (${name}): [${col}, ${row}] at (${x}, ${y})`);
  
  try {
    const outputPath = join(OUTPUT_DIR, `ball_${level}_${name}.png`);
    
    // Extract the cell from the sprite sheet
    const cellBuffer = await sharp(INPUT_SHEET)
      .extract({
        left: x,
        top: y,
        width: Math.floor(CELL_WIDTH),
        height: Math.floor(CELL_HEIGHT)
      })
      .ensureAlpha()
      .toBuffer();
    
    // Process pixels to remove white background
    const { data, info } = await sharp(cellBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const pixels = Buffer.from(data);
    
    // Remove white/very light pixels (make them transparent)
    // Check each pixel and set alpha to 0 if it's close to white
    for (let i = 0; i < pixels.length; i += info.channels) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = info.channels === 4 ? i + 3 : null;
      
      // If pixel is very light (RGB all > 240), make it transparent
      if (r > 240 && g > 240 && b > 240) {
        if (a !== null) {
          pixels[a] = 0;
        }
      } else if (a !== null) {
        // Keep or set opaque for non-white pixels
        pixels[a] = 255;
      }
    }
    
    // Create image from processed buffer
    const transparentImage = sharp(pixels, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels
      }
    });
    
    // Trim, pad to square, and resize
    const trimmed = await transparentImage
      .trim({ threshold: 10 })
      .toBuffer({ resolveWithObject: true });
    
    const maxDim = Math.max(trimmed.info.width, trimmed.info.height);
    const padX = Math.floor((maxDim - trimmed.info.width) / 2);
    const padY = Math.floor((maxDim - trimmed.info.height) / 2);
    
    await sharp(trimmed.data, {
      raw: {
        width: trimmed.info.width,
        height: trimmed.info.height,
        channels: trimmed.info.channels
      }
    })
    .extend({
      top: padY,
      bottom: maxDim - trimmed.info.height - padY,
      left: padX,
      right: maxDim - trimmed.info.width - padX,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
    
    const stats = await fs.stat(outputPath);
    console.log(`  ✓ Saved ${name}: ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`);
    
  } catch (err) {
    console.error(`  ✗ Failed to process ${name}:`, err.message);
    throw err;
  }
}

async function optimizeBackground() {
  const inputPath = join(__dirname, '../art/background.jpg');
  const outputPath = join(__dirname, '../assets/background.jpg');
  
  console.log('\nOptimizing background image...');
  
  await sharp(inputPath)
    .resize(720, 1280, { fit: 'cover' })
    .jpeg({ quality: 85, progressive: true })
    .toFile(outputPath);
  
  const stats = await fs.stat(outputPath);
  console.log(`✓ Background optimized: ${(stats.size / 1024).toFixed(1)} KB`);
}

async function main() {
  console.log('🎨 Sprite Sheet Slicer\n');
  console.log(`Input: ${INPUT_SHEET}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Grid: ${GRID_COLS}x${GRID_ROWS} = ${GRID_COLS * GRID_ROWS} sprites`);
  console.log(`Cell size: ${CELL_WIDTH}x${CELL_HEIGHT}`);
  console.log(`Output size: ${OUTPUT_SIZE}x${OUTPUT_SIZE}\n`);
  
  await ensureDir(OUTPUT_DIR);
  
  // Process all sprites
  for (let i = 0; i < BALL_NAMES.length; i++) {
    await sliceSprite(i);
  }
  
  // Optimize background
  await optimizeBackground();
  
  console.log('\n✅ All sprites generated successfully!');
  console.log(`\nOutput files:`);
  console.log(`  - ${OUTPUT_DIR}/ball_*.png (10 files)`);
  console.log(`  - ../assets/background.jpg`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
