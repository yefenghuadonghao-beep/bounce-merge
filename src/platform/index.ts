import { IPlatform } from './IPlatform';
import { WebPlatform } from './WebPlatform';

// 场景只通过这里拿平台实现；小游戏入口在启动时 setPlatform(new WeChatPlatform()) 即可替换。
let current: IPlatform | undefined;

export function setPlatform(platform: IPlatform): void {
  current = platform;
}

export function getPlatform(): IPlatform {
  return current ??= new WebPlatform();
}
