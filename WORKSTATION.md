# 工位麻薯养成系统

## 概述

「工位麻薯」是《弹弹合》中的元系统，灵感来自《植物大战僵尸》的禅境花园 / 智慧树。玩家在这里摆放和合成办公用品，培养麻薯员工，赚取麻薯币，解锁额外福利。

## 核心循环

1. **获取物品**：玩关卡（经典/残影模式）通关后，根据表现掉落物品到收件箱
2. **摆放合成**：从收件箱拖动物品到工位，两个相同类型和等级的物品可合并升级
3. **晋升员工**：物品达到最高等级后再次合并，晋升为麻薯员工（占据一个工位）
4. **产生收益**：员工持续产生麻薯币（包括离线时间，最多累计8小时）
5. **解锁工位**：用麻薯币解锁更多工位（最初6个，最多12个）
6. **老板巡查**：随机时间触发，限时点击应对获得奖励币
7. **游戏加成**：拥有员工时，进入关卡可获得小额加成（如开局+1球、金币倍率+5%）

## 物品与员工

### 物品类型（可合成）
- 📄 文件 (document)：Lv1-5，晋升为「实习生」
- ☕ 咖啡 (coffee)：Lv1-5，晋升为「初级员工」
- 📦 快递 (package)：Lv1-5，晋升为「高级员工」
- ⌨️ 键盘 (keyboard)：Lv1-4（不晋升）
- 🖱️ 鼠标 (mouse)：Lv1-4（不晋升）
- 🌱 绿植 (plant)：Lv1-3（不晋升）

### 员工类型（产币）
- 实习生 (intern)：10币/小时
- 初级 (junior)：25币/小时
- 高级 (senior)：50币/小时
- 主管 (lead)：100币/小时
- 经理 (manager)：200币/小时

## 配置说明

所有规则参数在 `src/config/workstationConfig.json`：

```json
{
  "initialDesks": 6,           // 初始工位数
  "maxDesks": 12,              // 最大工位数
  "deskUnlockCost": [100, 200, 400, 800, 1600, 3200],  // 解锁费用
  "maxInboxSize": 20,          // 收件箱容量
  "itemLevels": { ... },       // 物品等级和晋升规则
  "employeeProduction": { ... }, // 员工产币速率
  "offlineProductionCap": 28800000,  // 离线累计上限（8小时）
  "bossInspection": {
    "intervalMin": 1800000,    // 最小间隔（30分钟）
    "intervalMax": 3600000,    // 最大间隔（60分钟）
    "windowDuration": 30000,   // 响应窗口（30秒）
    "reward": 50,              // 成功奖励
    "penalty": 0               // 失败惩罚
  },
  "bonuses": { ... }           // 员工对弹球的加成
}
```

## 架构实现

### 核心逻辑（纯TS）
- `src/core/WorkstationSystem.ts`：所有规则，无Phaser/DOM依赖
  - 物品摆放、合成、晋升
  - 员工产币（注入时钟，支持离线）
  - 老板巡查触发与处理
  - 加成计算
  - 序列化/反序列化
- `src/core/__tests__/WorkstationSystem.test.ts`：25个单元测试覆盖

### 类型定义
- `src/types/workstation.ts`：所有数据结构

### 场景渲染
- `src/scenes/WorkstationScene.ts`：UI、拖拽、点击、自动保存
- `src/scenes/HomeScene.ts`：主屏幕入口

### 平台抽象
- `IPlatform.getCurrentTime()`：时间接口，用于离线产币计算
- 存储通过 `saveData/loadData` 持久化状态

## 开发与测试

运行测试：
```bash
npm test -- WorkstationSystem.test.ts
```

进入工位（开发模式）：
```
http://localhost:5173?scene=home
```
点击「进入工位」按钮

## 与主游戏集成

加成通过 `WorkstationSystem.calculateBonuses()` 计算，返回：
```typescript
{
  extraShotsAtStart: number,    // 开局额外发射数
  coinMultiplier: number        // 金币倍率
}
```

主游戏可在关卡开始时查询并应用这些加成。加成值保持小额（+1-2球，5%-20%倍率），不破坏现有平衡。

## 未来扩展

- 更多物品和员工类型
- 员工互动动画
- 工位装饰系统
- 成就和收集图鉴
- 更丰富的老板巡查事件
