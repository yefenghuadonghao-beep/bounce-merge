# 弹弹合 (BounceMerge)

一款结合弹珠台物理、2048合成和轻度Roguelike元素的休闲游戏。

## 游戏玩法

- 🎯 **瞄准发射**：从顶部瞄准并发射编号球体
- ⚡ **物理弹跳**：球体在钉板上按物理规律弹跳
- 🔄 **等级合成**：两个相同等级的球相碰时合成为更高等级（更大、不同颜色）
- 🎊 **连锁反应**：合成可以触发连锁反应，获得更高分数
- 🎮 **关卡目标**：每关有目标分数和发射次数限制
- ⬆️ **升级系统**：通关后从3个随机升级中选择1个
- 🏃 **Run系统**：连续通过多个关卡，目标分数递增

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

## 微信/抖音小游戏迁移指南

### 已完成的准备工作 ✅

1. **纯逻辑层**: 核心代码无Phaser依赖，可直接复用
2. **平台抽象**: `IPlatform`接口已定义，只需实现具体平台
3. **Canvas渲染**: 所有UI在Canvas内，无DOM/CSS依赖
4. **轻量化**: 无外部资源，程序生成图形，包体小
5. **固定尺寸**: 竖屏布局 720x1280，适配手机屏幕

### 迁移步骤

#### 1. 创建微信小游戏适配器 `WeChatPlatform.ts`

```typescript
import { IPlatform } from './IPlatform'

export class WeChatPlatform implements IPlatform {
  async saveData(key: string, value: string): Promise<void> {
    wx.setStorageSync(key, value)
  }

  async loadData(key: string): Promise<string | null> {
    return wx.getStorageSync(key) || null
  }

  getScreenSize() {
    const info = wx.getSystemInfoSync()
    return { width: info.screenWidth, height: info.screenHeight }
  }

  getSafeArea() {
    const info = wx.getSystemInfoSync()
    return info.safeArea || { top: 0, bottom: 0, left: 0, right: 0 }
  }

  playSound(soundId: string) {
    wx.createInnerAudioContext().play()
  }

  async share(title: string, imageUrl?: string) {
    return wx.shareAppMessage({ title, imageUrl })
  }

  async showAd() {
    // 使用微信激励视频广告
    const ad = wx.createRewardedVideoAd({ adUnitId: 'xxx' })
    return ad.show()
  }

  async login() {
    const { code } = await wx.login()
    // 调用后端换取token
    return { userId: 'xxx', nickname: 'xxx' }
  }
}
```

#### 2. 使用 `weapp-adapter`

```bash
npm install weapp-adapter
```

在入口文件顶部：

```typescript
import './weapp-adapter' // 提供window、canvas等Web API兼容
```

#### 3. 修改入口文件 `main.ts`

```typescript
// 根据环境选择平台
const platform: IPlatform = 
  typeof wx !== 'undefined' 
    ? new WeChatPlatform() 
    : new WebPlatform()
```

#### 4. 分包配置（控制包体大小）

`game.json`:

```json
{
  "deviceOrientation": "portrait",
  "subpackages": [
    {
      "name": "scenes",
      "root": "scenes/"
    }
  ]
}
```

#### 5. 性能优化建议

- **降低物理精度**: 在低端安卓上减少钉子数量
- **对象池**: 复用球体和粒子对象
- **降低帧率**: 低端设备使用30fps
- **延迟加载**: 关卡配置按需加载

### 抖音小游戏适配

与微信小游戏类似，主要差异：

- API前缀从`wx`改为`tt`
- 使用`tt.getSystemInfoSync()`
- 广告API: `tt.createRewardedVideoAd()`

### 包体大小限制

- 微信小游戏: 
  - 主包 ≤ 4MB
  - 总包 ≤ 20MB（使用分包）
- 抖音小游戏:
  - 主包 ≤ 4MB
  - 总包 ≤ 16MB

**本项目当前包体**: ~500KB（gzip后），远低于限制 ✅

### 测试检查清单

- [ ] 存档读写（wx.setStorage / tt.setStorage）
- [ ] 屏幕适配与安全区域
- [ ] 触摸输入响应
- [ ] 性能测试（低端安卓5.0+）
- [ ] 分享功能
- [ ] 激励视频广告
- [ ] 用户登录授权
- [ ] 横竖屏适配
- [ ] 刘海屏/异形屏适配

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

## 下一步开发

- [ ] 添加音效和背景音乐
- [ ] 实现关卡编辑器
- [ ] 添加更多升级类型（特殊钉子、球体技能）
- [ ] 排行榜系统
- [ ] 每日挑战
- [ ] 成就系统
- [ ] 微信小游戏适配
- [ ] 抖音小游戏适配

## 许可证

MIT

---

**独立开发者友好**: 本项目专为AI辅助独立开发设计，架构清晰，易于扩展和迁移。
