# 下班事务所美术资源

使用内置 image_gen 生成，两份最终资源均已放入项目；网页通过 assetUrl 加载，微信构建复制相同图片。

- `assets/office/room.webp`：900×1350，首页办公室主视觉，工位与关卡共用低透明度环境层。
- `assets/office/props.png`：1024×512，透明图集，4×2 等分帧：桌子、文件、咖啡、包裹、键盘、鼠标、绿植、金币。生成图先按物件边界裁切，再等比排进每个 256×256 帧，保留透明背景。

## 最终生图提示词

### 房间

Use case: illustration-story. Asset type: production mobile game background, portrait 2:3. Create a richly composed hand painted cozy tiny office diorama for a Chinese ugly-cute mochi animal game. Warm cream paper, caramel brown ink outlines, muted sage green, apricot, buttery yellow. Isometric cutaway room, large arched sunny window upper center, leafy plant, wall clock, bookshelves, two wooden office desks with old computers, coffee and files, little round tired grey cat wearing blue tie and capybara colleague resting at their desks. Soft gouache pencil texture, charming imperfect rounded shapes, clear large silhouettes, crisp professional casual game illustration. Top quarter quiet cream wall for code-rendered title; main diorama concentrated center and lower half. No text, letters, labels, logos, UI, or watermark. This is finished background artwork not a mockup. Save image to use inside repo.

### 物件图集

Use case: stylized-concept. Asset type: transparent sprite sheet for cozy hand-painted office merge mobile game. Exactly 8 separate game objects arranged in a precise 4-column by 2-row regular grid on transparent background, square canvas. Each cell same size, object centered, ample 15 percent transparent padding, no overlapping cells. Row 1 left to right: small wooden office desk viewed slightly from above with computer monitor at back and empty desk surface at front; stacked cream paper documents tied in sage ribbon; white ceramic coffee cup with saucer and coffee steam; small closed cardboard delivery parcel with tape. Row 2 left to right: rounded sage green computer keyboard; cream computer mouse; leafy potted succulent plant; golden coin with simple paw imprint. Warm cream, sage, caramel outlines, soft gouache paper texture, imperfect charming rounded hand drawn shapes, readable at small size. No text, no lettering, no borders, no shadows outside each object, no characters. Genuine alpha transparent background.

## 场景设计与验收

首页采用主插画、主闯关入口、残影与工位双入口。关卡路线可单关练习或从第一关连闯；练习简报直接读取真实障碍和预摆配置。此次没有改动已校准的弹道、难度和卡牌数值。

工位保留 12 格可操作区域与原经济配置，图片化桌面/物件/员工，加入待机、合成和收币补间。收益刷新只改文字，避免每秒销毁角色导致动画重启。拖拽物品仍遵循原同款同等级规则。此前目录里的拖拽、满工位合成和生命周期修复一起保留。

验证：240 项自动测试；网页生产构建；微信包构建（约 2.42 MB）；浏览器实测首页、两种路线、关卡简报、进入关卡、收件箱拖入桌面、同款合成、返回和存档。微信项目仍缺 weapp-adapter，因此未完成微信真机验收。

## 关卡机关与演出（第二轮）

新增内置 image_gen 生成的 `assets/office/ruler.webp`、`notebook.webp`、`coaster.webp`、`clock.webp`。原图按四个物件裁切透明留白，分别输出横向 768×96 和圆形 256×256。关卡配置的 `skin` 选择材质；图片直接使用该机关的位置、宽高、半径、角度，和物理几何共用配置。简报及选卡地图也显示相同材质。生图未改变机关尺寸、反弹参数、队列或目标数值。

合成采用短时光环、手绘星点、连锁/共鸣双环，浮字最多同时显示三条。通关采用高于游戏层的下班票据、角色弹出、印章落下和纸屑，2.2 秒后转场。章节结算同步办公室环境图和角色待机。

验收：243 项测试通过，涵盖 18 种后期卡牌路线、关卡物理回放和材质尺寸/轮廓类型；网页构建和微信构建通过。浏览器实际通过普通第 1 关与残影第 1 轮，检查第 8 关材质和布局，生产构建通过第 1 关并自动进入选卡页。微信包约 2.50 MB，依然缺少 weapp-adapter，未进行真机测试。

### 机关最终生图提示词

Use case: stylized-concept. Production texture atlas for a hand painted cozy office pinball mobile game. Transparent background. Square canvas in precise 2 columns by 2 rows, four isolated objects, generous empty space between objects. Top-left: a straight horizontal wooden ruler, VERY thin long rectangle, about 8 to 1 width to height, warm honey wood, small engraved tick marks, no numbers. Top-right: a single closed slim sage green notebook seen EDGE ON, VERY thin horizontal rectangular book spine, about 8 to 1 width to height, rounded corners, cream paper edge, tiny orange ribbon kept inside rectangular silhouette. Bottom-left: perfectly circular cream coffee coaster seen directly top down, caramel rim, small brown paw imprint centered, entirely inside circular boundary. Bottom-right: perfectly circular mint green office wall clock seen directly front on, cream face, small brown hands, entirely inside circular boundary. No perspective on the rectangular objects; their top surfaces must be flat horizontal so a physics ball can bounce off their exact edge. Warm cream paper, sage and apricot muted colors, soft gouache texture, dark brown pencil outlines matching an illustrated tiny office. No lettering, no logos, no shadows outside objects, no extra ornaments, no frame, no characters. Four separate assets only.


## 战术卡与下班回执（第三轮）

新增内置 image_gen 生成的三张独立透明插画：`assets/office/card-supply.webp`（补给箱与团子）、`card-control.webp`（排班夹板）、`card-chain.webp`（抱团搭子）。裁切透明留白后等比放入 400×400 画布，保留 alpha。

卡面从实际 battlePlanEffects 生成收益、用途、代价和下一关资源总数。三种动作分别为补给球跃起、队列交换和共鸣扩散；选择后落下已装备印章，其余卡片淡出，选择锁防止重复推进关卡。结算采用同一手绘纸张风格的回执，包含角色待机、盖章、分数计数、合成/连合统计、重试提示及工位入口。

验收：逐张选择经典终关三张卡，核对弹药 9/1/0、排班 8/1/3、抱团 8/2/0（发射/抱团/换球）；实际打完终关触发失败报告并重试，恢复同一关与战术初始资源。成功报告使用临时单关章节夹具，经实际发射合成进入结算并前往工位；验收后已恢复正式八关配置，未改变难度或卡牌效果。自动测试覆盖卡面前后期、不同模式数值和结算分支。微信仍缺少 weapp-adapter，未做真机验证。

### 最终生图提示词

弹药储备:

Production mobile game tactical card illustration, hand-painted gouache and colored pencil on warm cream, muted sage green and apricot palette, caramel brown ink outlines, rounded ugly-cute mochi animals matching a cozy tiny office. Single isolated composition, transparent background, readable at 140px, no words, letters, numbers, logos, UI or border. Square composition with generous clear padding. A round tired grey tabby cat wearing a loose blue tie proudly opening a cardboard supply box full of exactly three small round mochi balls, one peach, one cream, one sage. One ball pops up above the box. A warm little spark above the cat. The box and abundance clearly communicate extra ammunition / more attempts. Full cat and box visible.

排班高手:

Production mobile game tactical card illustration, hand-painted gouache and colored pencil on warm cream, muted sage green and apricot palette, caramel brown ink outlines, rounded ugly-cute mochi animals matching a cozy tiny office. Single isolated composition, transparent background, readable at 140px, no words, letters, numbers, logos, UI or border. Square composition with generous clear padding. A sleepy round capybara office planner holding a sage clipboard with three large colored mochi tokens arranged vertically, a pencil in the other paw, and three separate round tokens on the desk in front in peach, cream, sage colors. Two simple curved arrows indicate rearranging their order. Clear silhouette, organized controlled planning mood. Full body capybara and clipboard visible.

抱团连锁:

Production mobile game tactical card illustration, hand-painted gouache and colored pencil on warm cream, muted sage green and apricot palette, caramel brown ink outlines, rounded ugly-cute mochi animals matching a cozy tiny office. Single isolated composition, transparent background, readable at 140px, no words, letters, numbers, logos, UI or border. Square composition with generous clear padding. A round sage green frog holding coffee hugs a round cream cat and a peach hamster together in a close group. Three tiny golden energy sparkles link the hugging animals, with a soft circular sage arc behind them suggesting bringing scattered teammates together. Convey teamwork, gathering and chain merging, cuddly compact composition. All three characters fully visible.
