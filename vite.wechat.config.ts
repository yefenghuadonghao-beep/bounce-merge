import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { phaserCustomAlias, phaserFeatureFlags } from './vite.config';

// 微信小游戏构建：单文件 IIFE（小游戏不支持 ES module 和动态 import），由 game.js require。
// 资源不经打包器，assets.ts 换成原路径版本，图片/字体由 scripts/build-wechat.mjs 拷进代码包。
const wechatAssets = fileURLToPath(new URL('./src/platform/assets.wechat.ts', import.meta.url));

export default defineConfig({
  plugins: [
    phaserFeatureFlags(),
    {
      name: 'wechat-assets',
      enforce: 'pre',
      async resolveId(source, importer, options) {
        if (!/(^|\/)assets$/.test(source) || !importer) return null;
        const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
        return resolved && /[\\/]src[\\/]platform[\\/]assets\.ts$/.test(resolved.id) ? wechatAssets : null;
      }
    }
  ],
  resolve: { alias: [phaserCustomAlias] },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'import.meta.env.DEV': 'false'
  },
  build: {
    outDir: 'minigame/js',
    emptyOutDir: true,
    target: 'es2018',
    assetsInlineLimit: 0,
    copyPublicDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/wechat/main.ts', import.meta.url)),
      formats: ['iife'],
      name: 'BounceMergeGame',
      fileName: () => 'game.bundle.js'
    },
    rollupOptions: { output: { inlineDynamicImports: true } }
  }
});
