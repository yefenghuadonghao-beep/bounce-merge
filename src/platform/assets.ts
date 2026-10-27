// 交给构建工具输出带哈希的资源，开发和生产使用同一份路径映射。
const assets = {
  ...import.meta.glob('../../assets/characters/*', { eager: true, query: '?url', import: 'default' }),
  // 只打包 woff2；同目录的 ttf 留给小游戏构建。
  ...import.meta.glob('../../assets/fonts/*.woff2', { eager: true, query: '?url', import: 'default' })
} as Record<string, string>;

export function assetUrl(path: string): string {
  return assets[`../../${path}`] ?? path;
}
