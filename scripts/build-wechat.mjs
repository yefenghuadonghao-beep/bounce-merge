// npm run build:wechat：生成可直接用微信开发者工具打开的 minigame/ 目录。
//   minigame/game.js              入口：先 require weapp-adapter，再 require 游戏包
//   minigame/game.json            小游戏配置（竖屏）
//   minigame/project.config.json  开发者工具项目配置（appid 用 touristappid 占位）
//   minigame/js/game.bundle.js    vite 打的单文件 IIFE（含精简版 Phaser）
//   minigame/libs/weapp-adapter.js 从 wechat/libs/ 拷贝（需自行放入，见 docs/wechat-minigame.md）
//   minigame/assets/...           原路径拷贝的图片和 ttf 字体
import { build } from 'vite';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'minigame');
const MAIN_PACKAGE_LIMIT = 4 * 1024 * 1024;

rmSync(out, { recursive: true, force: true });
await build({ configFile: join(root, 'vite.wechat.config.ts'), logLevel: 'warn' });

function copy(from, to) {
  mkdirSync(dirname(join(out, to)), { recursive: true });
  copyFileSync(join(root, from), join(out, to));
}

// 运行时用到的资源：角色图集 + 两个字重的 ttf（wx.loadFont 不支持 woff2）。
copy('assets/characters/office-mochi.png', 'assets/characters/office-mochi.png');
for (const name of readdirSync(join(root, 'assets/office'))) copy(`assets/office/${name}`, `assets/office/${name}`);
for (const weight of ['regular', 'bold']) copy(`assets/fonts/mochi-rounded-${weight}.ttf`, `assets/fonts/mochi-rounded-${weight}.ttf`);
copy('art/fonts/OFL.txt', 'assets/fonts/OFL.txt');

const adapter = join(root, 'wechat/libs/weapp-adapter.js');
mkdirSync(join(out, 'libs'), { recursive: true });
let adapterMissing = false;
if (existsSync(adapter)) {
  copyFileSync(adapter, join(out, 'libs/weapp-adapter.js'));
} else {
  adapterMissing = true;
  writeFileSync(join(out, 'libs/weapp-adapter.js'),
    "throw new Error('缺少 weapp-adapter：把开发者工具小游戏模板里的 js/libs/weapp-adapter.js 放到 wechat/libs/ 后重新 npm run build:wechat（见 docs/wechat-minigame.md）');\n");
}

writeFileSync(join(out, 'game.js'), `// 由 npm run build:wechat 生成，请勿手改。
require('./libs/weapp-adapter.js');
require('./js/game.bundle.js');
`);
writeFileSync(join(out, 'game.json'), JSON.stringify({
  deviceOrientation: 'portrait',
  showStatusBar: false,
  networkTimeout: { request: 10000, downloadFile: 10000 }
}, null, 2) + '\n');
writeFileSync(join(out, 'project.config.json'), JSON.stringify({
  description: '下班团子 BounceMerge 微信小游戏（npm run build:wechat 生成）',
  compileType: 'game',
  appid: 'touristappid',
  projectname: 'bouncemerge',
  setting: { es6: true, enhance: true, minified: true, postcss: false, urlCheck: true },
  packOptions: { ignore: [{ type: 'file', value: 'assets/fonts/OFL.txt' }], include: [] }
}, null, 2) + '\n');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(out).map((p) => ({ path: relative(out, p), size: statSync(p).size })).sort((a, b) => b.size - a.size);
const total = files.reduce((sum, f) => sum + f.size, 0);
for (const f of files) console.log(`${(f.size / 1024).toFixed(1).padStart(9)} KB  ${f.path}`);
console.log(`${(total / 1024).toFixed(1).padStart(9)} KB  合计（主包上限 4096 KB，剩余 ${((MAIN_PACKAGE_LIMIT - total) / 1024).toFixed(0)} KB）`);
if (adapterMissing) console.warn('\n⚠ 未找到 wechat/libs/weapp-adapter.js，已写入会报错提示的占位文件。');
if (total > MAIN_PACKAGE_LIMIT) {
  console.error('主包超过 4MB，请把资源移到分包（docs/wechat-subpackages.md）');
  process.exit(1);
}
