import sharp from 'sharp';

// Analyze the background image to find the top edge of the bottom candy bar
const bgPath = '/workspace/assets/background.jpg';

const { data, info } = await sharp(bgPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const width = info.width;
const height = info.height;
const channels = info.channels;

console.log(`Background: ${width}x${height}, ${channels} channels`);

// Sample the center column to find where the candy bar starts
// The candy bar is a distinct horizontal feature at the bottom
const centerX = Math.floor(width / 2);

// Scan from bottom upward to find significant color change
// Bottom candy bar has warm peachy/wood tones
let candyBarTop = height - 1;

for (let y = height - 1; y > height * 0.6; y--) {
  const idx = (y * width + centerX) * channels;
  const r = data[idx];
  const g = data[idx + 1];
  const b = data[idx + 2];
  
  // Sample 10 pixels above current position
  const idxAbove = ((y - 10) * width + centerX) * channels;
  const rAbove = data[idxAbove];
  const gAbove = data[idxAbove + 1];
  const bAbove = data[idxAbove + 2];
  
  // Calculate color difference
  const diff = Math.abs(r - rAbove) + Math.abs(g - gAbove) + Math.abs(b - bAbove);
  
  // If we see a significant change from warmer to cooler tones, that's likely the candy bar top
  if (y % 50 === 0) {
    console.log(`y=${y}: rgb(${r},${g},${b}) diff=${diff}`);
  }
  
  // Look for the transition from playfield (pinkish gradient) to candy bar (peachy/wood)
  if (diff > 40 && r > 180 && g > 140 && b > 120) {
    candyBarTop = y;
    console.log(`\n*** Found candy bar top at y=${candyBarTop} ***`);
    console.log(`Color at candy bar: rgb(${r},${g},${b})`);
    break;
  }
}

console.log(`\nRecommended FLOOR_Y: ${candyBarTop - 20} (with 20px safety margin)`);
