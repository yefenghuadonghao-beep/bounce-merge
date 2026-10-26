# 包体与分包计划

微信限制（[官方文档](https://developers.weixin.qq.com/minigame/dev/guide/base-ability/subPackage/useSubPackage.html)，2026-10 查阅）：主包 ≤ 4MB；主包 + 分包总计 ≤ 30MB（未开通虚拟支付的小游戏为 20MB）；单个普通分包不限，独立分包 ≤ 4MB。

## 当前实测（`npm run build:wechat`，2026-10-26）

| 文件 | 大小 | gzip -9（参考） |
| --- | ---: | ---: |
| `js/game.bundle.js`（游戏代码 + 精简版 Phaser + 关卡 JSON） | 896.5 KB | 218.0 KB |
| `assets/characters/office-mochi.png` | 201.4 KB | — |
| `assets/fonts/mochi-rounded-regular.ttf` | 183.1 KB | 96.3 KB |
| `assets/fonts/mochi-rounded-bold.ttf` | 178.6 KB | 95.9 KB |
| 其余（game.js、配置、OFL、适配器占位） | ~5 KB | — |
| **合计** | **1,465 KB** | |

微信按文件原始大小计算包体。目前主包约占上限的 36%，还剩约 2.6MB；适配器本身通常几十 KB。

对比：未精简的 Phaser 单独就有 1,479 KB，换回完整版时主包约 2.1MB，仍在限制内，但余量少很多。

## 计划

现阶段（第一章，8 关）**不需要分包**，全部放主包启动最快。

内容增加后按以下顺序处理：

1. **先压资源**：图集 PNG 可以试 pngquant/有损压缩（当前 201 KB）；字体是按游戏用到的 372 个字生成的子集（`npm run font:subset`），新增文案后重新生成即可，不要放整套字体。
2. **按章节分包**：第二章起每章一个分包，主包只留启动必需的代码、第一章、通用图集和字体。
   - 构建：`scripts/build-wechat.mjs` 把 `chapters/<n>/`（关卡 JSON + 该章独有的图）拷到 `minigame/chapters/<n>/`，并在 `game.json` 写 `subpackages: [{ name: 'chapter2', root: 'chapters/2/' }]`。
   - 运行时：进入新章节前调 `wx.loadSubpackage({ name: 'chapter2' })`，成功后再从 `chapters/2/` 加载关卡和图片；可在上一章最后几关用 `wx.preDownloadSubpackage`（基础库 3.4.9+）预下载。
   - 代码层：这一步需要把「关卡配置从 JSON import 改成运行时读取」，放进 `IPlatform`（例如 `loadPackage(name)`，网页版直接返回）。属于结构调整，等第二章内容确定后再做。
3. **音乐/大音频**放分包或 CDN（`InnerAudioContext` 可以播网络地址），不进主包。

构建脚本在主包超过 4MB 时直接失败，防止无意中超限。
