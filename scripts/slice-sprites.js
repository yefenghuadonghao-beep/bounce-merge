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
    const { data: rawData, info: rawInfo } = await sharp(INPUT_SHEET)
      .extract({
        left: x,
        top: y,
        width: Math.floor(CELL_WIDTH),
        height: Math.floor(CELL_HEIGHT)
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const width = rawInfo.width;
    const height = rawInfo.height;
    const channels = 4; // Force RGBA
    
    // Create new buffer with alpha channel
    const pixels = Buffer.alloc(width * height * channels);
    
    // Copy RGB and initialize alpha
    for (let i = 0; i < width * height; i++) {
      const srcIdx = i * rawInfo.channels;
      const dstIdx = i * channels;
      pixels[dstIdx] = rawData[srcIdx];     // R
      pixels[dstIdx + 1] = rawData[srcIdx + 1]; // G
      pixels[dstIdx + 2] = rawData[srcIdx + 2]; // B
      pixels[dstIdx + 3] = 255;             // A (initially opaque)
    }
    
    // Step 1: Flood fill from edges to mark white background pixels
    const visited = new Uint8Array(width * height);
    const queue = [];
    const WHITE_THRESHOLD = 235; // Slightly lower to catch off-white
    const COLOR_TOLERANCE = 15;
    
    // Helper to check if pixel is white/light enough
    const isWhiteish = (x, y) => {
      const idx = (y * width + x) * channels;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      // Check if it's very light AND close to neutral gray
      return r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD &&
             Math.abs(r - g) < COLOR_TOLERANCE && Math.abs(g - b) < COLOR_TOLERANCE;
    };
    
    // Helper to mark pixel as background
    const markBackground = (x, y) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const pixelIdx = y * width + x;
      if (visited[pixelIdx]) return;
      if (!isWhiteish(x, y)) return;
      
      visited[pixelIdx] = 1;
      queue.push([x, y]);
    };
    
    // Start flood fill from all edges
    for (let x = 0; x < width; x++) {
      markBackground(x, 0); // Top edge
      markBackground(x, height - 1); // Bottom edge
    }
    for (let y = 0; y < height; y++) {
      markBackground(0, y); // Left edge
      markBackground(width - 1, y); // Right edge
    }
    
    // Process queue
    while (queue.length > 0) {
      const [x, y] = queue.shift();
      markBackground(x - 1, y);
      markBackground(x + 1, y);
      markBackground(x, y - 1);
      markBackground(x, y + 1);
    }
    
    // Step 2: Apply circular mask centered on content
    // Find bounding box of non-background content
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIdx = y * width + x;
        if (!visited[pixelIdx] && !isWhiteish(x, y)) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const radius = Math.max(maxX - minX, maxY - minY) / 2 + 5; // Add small padding
    const featherPixels = 3; // Feather edge to remove white halos
    
    // Step 3: Set alpha based on flood fill + circular mask
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const pixelIdx = y * width + x;
        const alphaIdx = idx + 3;
        
        if (visited[pixelIdx]) {
          // Background pixel from flood fill
          pixels[alphaIdx] = 0;
        } else {
          // Calculate distance from center for circular mask
          const dx = x - centerX;
          const dy = y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > radius) {
            // Outside circle
            pixels[alphaIdx] = 0;
          } else if (dist > radius - featherPixels) {
            // Feather edge
            const alpha = ((radius - dist) / featherPixels) * 255;
            pixels[alphaIdx] = Math.max(0, Math.min(255, Math.floor(alpha)));
          } else {
            // Inside circle
            pixels[alphaIdx] = 255;
          }
        }
      }
    }
    
    // Create image from processed buffer
    const transparentImage = sharp(pixels, {
      raw: {
        width: width,
        height: height,
        channels: channels
      }
    });
    
    // Save with transparency (don't trim, just resize to square)
    await transparentImage
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png({ compressionLevel: 9, force: true })
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
