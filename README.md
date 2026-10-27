# 下班团子 (BounceMerge)

丑萌打工动物主题的弹射合成游戏。

## 当前试玩版（2026-10-23）

第一章包含 8 个手工关卡，从一发合成教学到有限发射与组合障碍挑战。

- 每关独立地图、预摆团子、固定发射顺序与工具次数；见 [完整关卡表](./CHAPTER_ONE.md)。
- 每 450ms 可发射一球，瞄准时提示同款目标。
- 合成带弹性反馈、情绪台词和连合音效；连续合成可加速充能，获得抱团救场。
- 支持本关重试，恢复入口分数与福利；第 8 关后进入章节通关页。
- 关间提供不改变球径和发射等级的福利，避免破坏手工关卡解法。
- 支持音效开关和本地最高分；美术由 Vite 打包。

这是浏览器可玩的玩法原型。微信小游戏的平台实现和构建（`npm run build:wechat`）已就绪，但还没在微信开发者工具或真机上验证；广告和登录仍是占位实现。

玩法依据、验证结果和下一轮验证重点见 [GAMEPLAY.md](./GAMEPLAY.md)。

## 游戏玩法

- 🎯 **瞄准发射**：从顶部瞄准并发射编号球体
- ⚡ **物理弹跳**：球体在钉板上按物理规律弹跳
- 🔄 **等级合成**：两个相同等级的球相碰时合成为更高等级（更大、不同颜色）
- 🎊 **连锁反应**：合成可以触发连锁反应，获得更高分数
- 🎮 **关卡目标**：每关有目标角色和发射次数限制
- ⬆️ **升级系统**：通关后从3个随机升级中选择1个
- 🏃 **Run系统**：完成第一章八关，挑战更少发射与更高连合

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式运行

```bash
npm run dev
```

浏览器访问 `http://localhost:5173` 即可游玩。

### 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录，可部署到任何静态服务器。

正式构建使用精简版 Phaser（`src/vendor/phaser-custom.js`，经 vite alias 替换 `phaser`），
只打包 WebGL/Canvas 渲染、场景、相机、输入、补间、计时、Matter 物理和游戏用到的 GameObject，
去掉 Arcade 物理、Tilemap、Phaser 声音、粒子等：Phaser chunk 从 1,478.57 kB（gzip 339.68 kB）
降到 877.00 kB（gzip 211.89 kB）。开发模式和单元测试仍使用完整版 Phaser，
所以**新用到某个 Phaser 功能时要在 `phaser-custom.js` 里补上**，并用 `npm run build && npx vite preview`
确认；`src/vendor/__tests__/phaserCustom.test.ts` 会检查所有 `add.xxx` 和运行时 `Phaser.*` 引用是否都在精简版里。

### 运行测试

```bash
npm test          # 运行所有测试
npm run test:watch # 监听模式运行测试
```

## 项目结构

```
src/
├── config/              # 数据驱动的游戏配置（易于调整）
│   ├── ballLevels.json     # 球体等级定义（大小、颜色、分数）
│   ├── levelConfig.json    # 关卡配置（目标分数、发射次数）
│   ├── upgrades.json       # 升级列表定义
│   └── gameConfig.json     # 游戏全局配置（物理、钉板、发射器）
│
├── core/                # 纯逻辑层（无Phaser依赖，可单元测试）
│   ├── GameStateManager.ts # 游戏状态管理（分数、关卡、升级）
│   ├── MergeSystem.ts      # 合成规则逻辑
│   ├── GameController.ts   # 游戏流程控制器
│   └── __tests__/          # 核心逻辑单元测试
│
├── platform/            # 平台抽象层（为小游戏迁移做准备）
│   ├── IPlatform.ts        # 平台接口定义
│   └── WebPlatform.ts      # Web平台实现
│
├── scenes/              # Phaser场景（展示层）
│   ├── MainScene.ts        # 主游戏场景
│   ├── UpgradeScene.ts     # 升级选择场景
│   └── GameOverScene.ts    # 游戏结束场景
│
├── types/               # TypeScript类型定义
│   └── index.ts
│
└── main.ts              # 入口文件
```

## 架构设计

### 三层架构

本项目采用三层架构，专为**微信/抖音小游戏迁移**而设计：

#### 1. 核心逻辑层 (`src/core/`)

- ✅ **纯TypeScript实现**，零Phaser依赖
- ✅ **完全可测试**，所有业务逻辑都有单元测试覆盖
- ✅ **无副作用**，所有函数都是纯函数或明确管理状态
- ✅ **可序列化**，游戏状态可以JSON序列化/反序列化

包含：
- `GameStateManager`: 管理分数、关卡、combo、升级效果
- `MergeSystem`: 合成规则、分数计算
- `GameController`: 游戏流程控制，协调各系统

#### 2. 平台抽象层 (`src/platform/`)

隔离平台特定API，便于适配不同平台：

```typescript
interface IPlatform {
  // 存储
  saveData(key: string, value: string): Promise<void>
  loadData(key: string): Promise<string | null>
  
  // 屏幕与设备
  getScreenSize(): { width: number; height: number }
  getSafeArea(): { top, bottom, left, right }
  getDevicePixelRatio(): number
  
  // 音频（占位，待实现）
  playSound(soundId: string): void
  playMusic(musicId: string): void
  
  // 社交功能（占位，待实现）
  share(title: string, imageUrl?: string): Promise<boolean>
  showAd(): Promise<boolean>
  login(): Promise<UserInfo | null>
}
```

当前实现：
- `WebPlatform`: Web浏览器实现（使用localStorage）
- **未来添加**: `WeChatPlatform`, `DouyinPlatform`

#### 3. 展示层 (`src/scenes/`)

- 使用Phaser 3渲染
- 所有UI都在Canvas内绘制（无DOM覆盖层）
- 通过`GameController`调用核心逻辑
- 通过`IPlatform`访问平台功能

### 设计原则

1. **逻辑与展示分离**
   - 核心逻辑不依赖Phaser
   - 场景只负责渲染和输入，不包含游戏规则

2. **平台无关性**
   - 不直接使用`window`、`document`、`localStorage`
   - 所有平台相关调用通过`IPlatform`接口

3. **数据驱动**
   - 所有可调参数都在JSON配置文件中
   - 易于AI生成和人工调整

4. **性能优化**
   - 固定步长更新（Phaser默认）
   - 控制物理体数量（钉子静态，球体有限）
   - 无外部资源依赖（程序生成图形）

## 配置文件说明

### `ballLevels.json` - 球体等级

```json
[
  {
    "level": 1,        // 球体等级
    "radius": 12,      // 半径（像素）
    "color": 0xff6b6b, // 颜色（十六进制）
    "score": 10        // 合成后获得的基础分数
  }
]
```

### `levelConfig.json` - 关卡配置

```json
[
  {
    "level": 1,          // 关卡编号
    "targetScore": 500,  // 目标分数
    "shots": 15          // 可发射次数
  }
]
```

### `upgrades.json` - 升级定义

```json
[
  {
    "id": "extra_shot",      // 唯一ID
    "name": "额外发射",       // 显示名称
    "description": "获得+1次发射机会",
    "type": "stat",          // 类型: stat/multiplier/passive
    "value": 1               // 数值
  }
]
```

### `gameConfig.json` - 游戏全局配置

包含物理参数、钉板布局、发射器设置、计分规则等。

## 微信/抖音小游戏

```bash
npm run build:wechat   # 输出 minigame/，用微信开发者工具导入该目录
```

- 构建方式、weapp-adapter 接入要求、已验证/未验证清单：[docs/wechat-minigame.md](./docs/wechat-minigame.md)
- 包体实测和分包计划：[docs/wechat-subpackages.md](./docs/wechat-subpackages.md)

`WeChatPlatform`（`src/platform/WeChatPlatform.ts`）已实现存档、窗口/安全区、字体、音效、分享和前后台；广告和登录仍是占位。网页入口 `src/main.ts` 和小游戏入口 `src/wechat/main.ts` 共用 `src/boot.ts`。尚未在微信开发者工具或真机上运行过。

抖音小游戏接口与 `wx` 大体一致（前缀 `tt`），可照 `WeChatPlatform` 写 `DouyinPlatform`，未开始。

## 技术栈

- **TypeScript**: 类型安全
- **Vite**: 快速构建和热更新
- **Phaser 3**: 游戏引擎（含Matter.js物理引擎）
- **Vitest**: 单元测试框架

## 开发规范

1. **核心逻辑必须有单元测试覆盖**
2. **不在`src/core/`中使用Phaser API**
3. **平台相关调用必须通过`IPlatform`接口**
4. **所有UI文字使用简体中文**
5. **代码和注释使用英文**
6. **配置文件使用JSON，易于AI生成**

## AI 美术管线

本项目使用AI生成的美术资源，通过自动化脚本处理和集成。

### 美术资源

- `art/balls_sheet.jpg` - 10个球体角色的原始精灵图（5x2网格，1280x720）
- `art/background.jpg` - 糖果风格的游戏背景（720x1280）
- `assets/sprites/ball_*.png` - 处理后的透明PNG精灵（256x256）
- `assets/background.jpg` - 优化后的背景图（83.1 KB）

### 重新生成精灵

当美术资源更新时，运行精灵切片脚本：

```bash
python3 scripts/slice_sprites.py
```

脚本功能（使用scipy图像处理）：
- 从精灵图中提取10个球体（按阅读顺序：5列×2行）
- 边界连接的亮色背景移除（flood-fill from edges）
- 连通分量分析，每个网格单元取最大组件
- 星星特殊处理：包含周围的闪光效果
- 填充空洞，裁剪到精确边界框
- 在正方形画布上居中（2%填充）
- 缩放到256x256高分辨率（LANCZOS插值）
- 生成预览图 `art/sprites_preview.png`（不提交到git）

**依赖**: `pip install numpy scipy pillow`

### 球体名称映射

| 等级 | 名称 | 文件名 | 描述 |
|-----|------|--------|------|
| 1 | 蓝莓 (blueberry) | `ball_1_blueberry.png` | 可爱的蓝色浆果 |
| 2 | 樱桃 (cherry) | `ball_2_cherry.png` | 红色樱桃带叶子 |
| 3 | 草莓 (strawberry) | `ball_3_strawberry.png` | 带籽的草莓 |
| 4 | 青柠 (lime) | `ball_4_lime.png` | 绿色青柠 |
| 5 | 橙子 (orange) | `ball_5_orange.png` | 橙色橙子 |
| 6 | 桃子 (peach) | `ball_6_peach.png` | 粉色桃子 |
| 7 | 苹果 (apple) | `ball_7_apple.png` | 红色苹果 |
| 8 | 椰子 (coconut) | `ball_8_coconut.png` | 棕色椰子 |
| 9 | 西瓜 (watermelon) | `ball_9_watermelon.png` | 绿色西瓜 |
| 10 | 星星果 (star) | `ball_10_star.png` | 金色星星果带闪光 |

### 替换美术资源

1. 将新的精灵图保存为 `art/balls_sheet.jpg`（**必须是5x2网格**，白色背景）
2. 将新的背景保存为 `art/background.jpg`（推荐720x1280竖屏）
3. 运行 `node scripts/slice-sprites.js`
4. 生成的资源会自动替换 `assets/` 目录下的文件

### 配置精灵路径

精灵路径在 `src/config/ballLevels.json` 中配置：

```json
{
  "level": 1,
  "radius": 12,
  "color": 16738923,
  "score": 10,
  "sprite": "assets/sprites/ball_1_blueberry.png"
}
```

**配置说明**：
- `sprite` 字段为**可选**，如果不存在则使用程序生成的圆形
- 物理碰撞仍然使用圆形（性能优化，由`radius`决定）
- 精灵会自动缩放到对应的球体直径（`radius * 2`）
- 纹理加载通过平台抽象层，支持小游戏迁移

### 资源大小

当前资源总大小：**~460KB**（压缩前）
- 背景：83.1 KB
- 10个精灵：约 28-38 KB 每个（总计 ~346 KB）

**符合微信/抖音小游戏的包体积要求（主包<4MB）** ✅

### 视觉设计说明

- **钉子**：10px半径的糖果色圆形，带白色描边高光
- **背景**：粉紫色渐变糖果墙，带糖果木边框
- **钉板布局**：9行×7列交错排列，位于背景边框内（280-1000px高度）
- **HUD面板**：半透明黑色面板（alpha 0.5），确保文字可读
- **文字样式**：白色/彩色文字带黑色描边（4-6px）

## 下一步开发

- [ ] 添加音效和背景音乐
- [ ] 实现关卡编辑器
- [ ] 添加更多升级类型（特殊钉子、球体技能）
- [ ] 排行榜系统
- [ ] 每日挑战
- [ ] 成就系统
- [ ] 微信小游戏：接入 weapp-adapter 并在开发者工具/真机验证（见 docs/wechat-minigame.md）
- [ ] 抖音小游戏适配

## 许可证

MIT

---

**独立开发者友好**: 本项目专为AI辅助独立开发设计，架构清晰，易于扩展和迁移。
