// 生成游戏用的圆体子集：npm run font:subset
// 源字体：Resource Han Rounded CN 0.990（SIL OFL 1.1），见 art/fonts/README.md。
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
import { collectCharset } from './font-charset.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'art/fonts/source');
const outDir = join(root, 'assets/fonts');
const weights = [
  { file: 'ResourceHanRoundedCN-Regular.ttf', out: 'mochi-rounded-regular' },
  { file: 'ResourceHanRoundedCN-Bold.ttf', out: 'mochi-rounded-bold' }
];

const missing = weights.filter((w) => !existsSync(join(sourceDir, w.file)));
if (missing.length) {
  console.error(`缺少源字体：${missing.map((w) => w.file).join(', ')}\n请按 art/fonts/README.md 下载并解压到 art/fonts/source/`);
  process.exit(1);
}

const charset = collectCharset(root);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'charset.txt'), charset);
for (const w of weights) {
  const source = readFileSync(join(sourceDir, w.file));
  for (const [format, ext] of [['woff2', 'woff2'], ['sfnt', 'ttf']]) {
    const buf = await subsetFont(source, charset, { targetFormat: format });
    writeFileSync(join(outDir, `${w.out}.${ext}`), buf);
    console.log(`${w.out}.${ext}: ${(buf.length / 1024).toFixed(1)} KB`);
  }
}
console.log(`glyphs: ${[...charset].length}`);
