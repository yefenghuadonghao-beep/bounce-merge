import sharp from 'sharp';

const files = [
  '/workspace/assets/sprites/ball_5_orange.png',
  '/workspace/assets/sprites/ball_6_peach.png', 
  '/workspace/assets/sprites/ball_8_coconut.png',
  '/workspace/assets/sprites/ball_9_watermelon.png',
  '/workspace/assets/sprites/ball_10_star.png'
];

for (const file of files) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  
  const name = file.split('/').pop();
  const w = info.width;
  const h = info.height;
  const channels = info.channels;
  
  // Check corners (top-left, top-right, bottom-left, bottom-right)
  const corners = [
    { name: 'TL', x: 0, y: 0 },
    { name: 'TR', x: w - 1, y: 0 },
    { name: 'BL', x: 0, y: h - 1 },
    { name: 'BR', x: w - 1, y: h - 1 }
  ];
  
  console.log(`\n${name} (${w}x${h}):`);
  for (const corner of corners) {
    const idx = (corner.y * w + corner.x) * channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const alpha = data[idx + 3];
    console.log(`  ${corner.name}(${corner.x},${corner.y}): rgba(${r},${g},${b},${alpha})`);
  }
}
