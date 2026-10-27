# 微信小游戏构建

```bash
npm run build:wechat      # tsc + scripts/build-wechat.mjs，输出 minigame/
```

用微信开发者工具「导入项目」选 `minigame/` 目录即可打开（appid 先用 `touristappid` 占位，上线前在 `scripts/build-wechat.mjs` 里改成正式 appid）。`minigame/` 是构建产物，已加入 `.gitignore`。

## 产物结构

| 文件 | 来源 | 说明 |
| --- | --- | --- |
| `game.js` | 脚本生成 | 先 `require('./libs/weapp-adapter.js')`，再 `require('./js/game.bundle.js')` |
| `game.json` | 脚本生成 | `deviceOrientation: portrait`，`showStatusBar: false` |
| `project.config.json` | 脚本生成 | `compileType: game`，appid 占位 |
| `js/game.bundle.js` | `vite.wechat.config.ts` | 单文件 IIFE，入口 `src/wechat/main.ts`，含精简版 Phaser |
| `libs/weapp-adapter.js` | `wechat/libs/` | 需自行放入；缺失时写入一个启动即报错的占位文件 |
| `assets/characters/office-mochi.png` | 原样拷贝 | 角色图集 |
| `assets/fonts/mochi-rounded-{regular,bold}.ttf` | 原样拷贝 | `wx.loadFont` 只认 ttf 等本地文件，不用 woff2 |

## 代码结构

- `src/boot.ts`：网页和小游戏共用的启动流程（注册平台、加载字体、算分辨率、建 `Phaser.Game`、注册场景、前后台暂停）。
- `src/main.ts`：网页入口，`WebPlatform` + `layout: 'fit'`（Phaser `Scale.FIT` 居中缩放）。
- `src/wechat/main.ts`：小游戏入口，`WeChatPlatform` + `layout: 'fill'`：
  - 画布铺满屏幕，像素尺寸 = 窗口 × min(pixelRatio, 3 / 适配倍数)（`computeFillLayout`）；
  - 摄像机缩放后把 720×1280 的设计区域居中，多出来的部分用 `letterboxColor` 留边；
  - 传入适配器创建的主屏 canvas，`type: Phaser.WEBGL`；
  - 加载器设 `imageLoadType: 'HTMLImageElement'`（小游戏没有 Blob URL，Phaser 默认的 XHR→Blob 方式不可用）。
- `src/platform/WeChatPlatform.ts`：`IPlatform` 的微信实现（存档、窗口信息/安全区、字体、音效、分享、前后台）。广告和登录仍是占位（`showAd` 返回 false，`login` 返回 null）。
- `src/platform/assets.wechat.ts`：构建时替换 `assets.ts`，资源路径原样返回，图片/字体不被打包器内联或改名。
- `getPlatform()` 不再默认创建 `WebPlatform`，所以网页实现不会被打进小游戏包。

## weapp-adapter

小游戏环境没有 `window`/`document`/DOM 事件，Phaser 需要一层适配器。**仓库不附带适配器**，原因：

- npm 上的 `weapp-adapter` 包是给小程序用的旧包，不是小游戏适配器；
- 官方适配器随开发者工具的小游戏模板提供（新建一个「小游戏 → JS 模板」项目，取 `js/libs/weapp-adapter.js` 和它依赖的同目录文件，按模板的方式打成一个文件或一起拷过来）；社区维护的 [finscn/weapp-adapter](https://github.com/finscn/weapp-adapter)（MIT）是同一思路的可读版本。选定后放到 `wechat/libs/weapp-adapter.js`，并在本文档记下来源和版本。

Phaser 3.90 在小游戏里依赖适配器提供下面这些（接入后需在开发者工具和真机逐项确认）：

- [ ] `window`、`document`、`navigator.userAgent`、`window.devicePixelRatio`、`document.readyState === 'complete'`（Phaser 启动等 DOMContentLoaded）
- [ ] 首次 `wx.createCanvas()` 的主屏 canvas 挂到 `GameGlobal.canvas`/`window.canvas`（入口优先用它，没有才自己创建）
- [ ] `document.createElement('canvas')` 返回离屏 canvas（Phaser 做纹理和文字时会用）
- [ ] `Image` / `HTMLImageElement` 用 `wx.createImage()` 实现，`src` 支持代码包内相对路径和 `data:image/png;base64`（Phaser 内置的 `__DEFAULT`/`__MISSING`/`__WHITE` 纹理是 base64）
- [ ] 触摸事件：`wx.onTouchStart/Move/End/Cancel` 转成 DOM `TouchEvent`，`target` 指向主屏 canvas，并让 `canvas.addEventListener('touchstart', …)` 能收到（Phaser 的 TouchManager 挂在 canvas 上）
- [ ] `requestAnimationFrame` / `cancelAnimationFrame`
- [ ] `localStorage` 可选（存档走 `wx.setStorageSync`，不依赖它）

音频不经 Phaser（构建里关掉了 Phaser 的声音模块）：音效用 `wx.createWebAudioContext()` 合成，背景音乐用 `wx.createInnerAudioContext()` 播放 `assets/audio/<id>.mp3`（目前没有音乐文件）。

## 已验证 / 未验证

在盒子里能做到的验证（没有微信开发者工具和真机）：

已验证：
- `npm run build:wechat` 产出完整目录，总大小 1,465 KB（见 [包体与分包计划](./wechat-subpackages.md)），超过 4MB 会让构建失败。
- 包内不含 `WebPlatform`、woff2、内联字体；`new Function(bundle)` 语法检查通过（目标 ES2018）。
- `WeChatPlatform` 单元测试（伪造的 `wx`，13 项）：存档前缀与空值、窗口信息与旧接口回退、安全区换算、字体名、音效开关持久化、音乐循环与销毁、前后台挂起/恢复、分享菜单与回调。
- 浏览器模拟（`npm run build:wechat && npm run sim:wechat -- out.png 3 390 844 "108,563>110,565"`，脚本 `scripts/wechat-sim.mjs`）：真 Chrome + 伪造的 `wx` 对象和全局 `canvas`，加载 `minigame/js/game.bundle.js`：
  - 390×844@3 → 画布 1170×2532，上下留边，字体为 Resource Han Rounded CN，图集从 `assets/characters/` 正常加载，拖拽发射成功（剩余球数 3→2）；
  - 768×1024@2 → 画布 1536×2048，左右留边；
  - 调用顺序：`showShareMenu`、两次 `loadFont`；前后台回调触发后无报错。
  这只证明打包、资源路径和填充布局在浏览器里成立，**不代表微信运行时可用**。

未验证（需要开发者工具/真机）：
- 适配器接入后的一切运行时行为（上面的清单）。
- `wx.loadFont` 返回的字体名能否让 700 字重选中粗体文件（两个 ttf 字体名相同，只有字重不同）。
- `wx.createWebAudioContext()` 是否支持本项目合成音效用到的 `createOscillator`/`createGain`/频率包络。
- WebGL 在低端安卓上的帧率和内存；必要时可改成 `Phaser.CANVAS`（精简版里两个渲染器都保留了）。
- 分享卡片样式、`shareTimeline` 是否需要额外开通。
- 抖音小游戏（`tt`）：接口与 `wx` 大体一致，可照 `WeChatPlatform` 写一个 `DouyinPlatform`，未开始。
