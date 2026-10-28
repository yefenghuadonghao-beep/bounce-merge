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
