import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

// Phaser 源码用 `typeof FEATURE_SOUND` 之类的编译期开关决定是否打包某些模块，
// 官方用 webpack DefinePlugin 替换；这里对 phaser/src 做同样的文本替换。
const phaserFlags: Record<string, boolean> = {
  CANVAS_RENDERER: true,
  WEBGL_RENDERER: true,
  WEBGL_DEBUG: false,
  EXPERIMENTAL: false,
  PLUGIN_3D: false,
  PLUGIN_CAMERA3D: false,
  PLUGIN_FBINSTANT: false,
  FEATURE_SOUND: false
};

export function phaserFeatureFlags(): Plugin {
  const pattern = new RegExp(`typeof (${Object.keys(phaserFlags).join('|')})\\b`, 'g');
  return {
    name: 'phaser-feature-flags',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]node_modules[\\/]phaser[\\/]src[\\/]/.test(id) || !pattern.test(code)) return null;
      pattern.lastIndex = 0;
      return { code: code.replace(pattern, (_m, flag: string) => JSON.stringify(phaserFlags[flag])), map: null };
    }
  };
}

// 正式构建用精简版 Phaser（src/vendor/phaser-custom.js）；开发和测试保持完整版。
export const phaserCustomAlias = {
  find: /^phaser$/,
  replacement: fileURLToPath(new URL('./src/vendor/phaser-custom.js', import.meta.url))
};

export default defineConfig(({ command }) => ({
  base: './',
  plugins: command === 'build' ? [phaserFeatureFlags()] : [],
  resolve: {
    alias: command === 'build' ? [phaserCustomAlias] : []
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/phaser/') || id.includes('/src/vendor/phaser-custom')) return 'phaser';
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
}));
