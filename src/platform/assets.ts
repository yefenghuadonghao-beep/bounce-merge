// 交给构建工具输出带哈希的资源，开发和生产使用同一份路径映射。
const assets = import.meta.glob('../../assets/**/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function assetUrl(path: string): string {
  return assets[`../../${path}`] ?? path;
}
