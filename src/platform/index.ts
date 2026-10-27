import { IPlatform } from './IPlatform';

// 场景只通过这里拿平台实现；入口在启动时 setPlatform（网页 WebPlatform，小游戏 WeChatPlatform）。
// 不在这里默认 new WebPlatform()，否则小游戏包也会把网页实现打进去。
let current: IPlatform | undefined;

export function setPlatform(platform: IPlatform): void {
  current = platform;
}

export function getPlatform(): IPlatform {
  if (!current) throw new Error('getPlatform() called before setPlatform()');
  return current;
}
