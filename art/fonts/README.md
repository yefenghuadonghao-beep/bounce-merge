# 游戏字体

- 字体：Resource Han Rounded CN 0.990（思源黑体的圆角改版，作者 Cyano Hao）
- 许可：SIL Open Font License 1.1（全文见同目录 `OFL.txt`）。保留字体名只有 “Source”，
  子集化后的文件在游戏里以 `MochiRounded` 名称加载，不会用到保留名。
- 来源：https://github.com/CyanoHao/Resource-Han-Rounded/releases/tag/v0.990
  （`RHR-CN-0.990.7z`，sha256 `e7005f7b4a7a0b8352d32c4a1358ff47564eb73be7fdb2db00d9f792755e9dc7`）

## 重新生成子集

源字体单个约 14MB，不进仓库。把压缩包里的
`ResourceHanRoundedCN-Regular.ttf`（sha256 `1c5c623f…dc0`）和
`ResourceHanRoundedCN-Bold.ttf`（sha256 `f713907a…07c3`）解压到 `art/fonts/source/`，然后：

```sh
npm run font:subset
```

脚本（`scripts/subset-font.mjs`）会收集 `src/` 里 TS 字符串字面量、配置 JSON 的全部字符，
加上 ASCII 和常用中文标点，输出到 `assets/fonts/`：

- `mochi-rounded-{regular,bold}.woff2`：Web 构建使用
- `mochi-rounded-{regular,bold}.ttf`：小游戏 `wx.loadFont` 使用（不进 Web 包）
- `charset.txt`：已包含的字符；`src/ui/__tests__/fonts.test.ts` 会检查文案里的新字是否都在其中，
  改了文案测试失败时重跑上面的命令即可。
