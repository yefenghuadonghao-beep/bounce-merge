#!/usr/bin/env node
/**
 * Capture afterimage mode screenshots using deterministic firing
 * Usage: node scripts/capture-afterimage.mjs
 */
import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';

const ARTIFACT_DIR = '/opt/cursor/artifacts';
mkdirSync(ARTIFACT_DIR, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const getMD5 = (buf) => createHash('md5').update(buf).digest('hex');

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 720, height: 1280 });
    
    // 监听console
    page.on('console', msg => {
      if (msg.text().includes('[showVictory]')) {
        console.log('🎮', msg.text());
      }
    });

    await page.goto('http://localhost:5173?mode=afterimage&debug=nowin,nooverlay&t=' + Date.now(), {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForSelector('canvas', { timeout: 20000 });
    await sleep(8000);

    // Use deterministic firing hook
    async function fire(angle, waitMs = 7000) {
      const result = await page.evaluate((a) => {
        if (window.__bm && window.__bm.fire) {
          const scenes = window.game?.scene?.scenes || [];
          const activeSceneKeys = scenes.filter(s => s.scene.isActive()).map(s => s.scene.key);
          const mainScene = scenes.find(s => s.scene.key === 'MainScene' && s.scene.isActive());
          const state = {
            totalScenes: scenes.length,
            activeScenes: activeSceneKeys,
            mainSceneActive: !!mainScene,
            canShoot: mainScene?.canShoot,
            resolving: mainScene?.resolving
          };
          window.__bm.fire(a);
          return state;
        }
        return { error: 'no __bm.fire' };
      }, angle);
      console.log(`  发射状态:`, JSON.stringify(result));
      await sleep(waitMs);
    }

    // Scenario 1: Multiple afterimage tracks
    console.log('场景1: 创建多条残影轨迹');
    await fire(Math.PI / 2 + 0.3, 6000);
    await fire(Math.PI / 2 - 0.2, 6000);
    await fire(Math.PI / 2 + 0.5, 6000);

    console.log('📸 截图1: 多条残影轨迹');
    const shot1 = await page.screenshot();
    writeFileSync(`${ARTIFACT_DIR}/afterimage-1-tracks.png`, shot1);
    console.log(`  ${(shot1.length / 1024).toFixed(1)} KB, MD5: ${getMD5(shot1)}`);

    // Scenario 2: Ball bouncing off afterimage (capture mid-flight)
    console.log('\n场景2: 球体与残影交互');
    await fire(Math.PI / 2 - 0.4, 1500);  // 短等待捕捉mid-flight

    console.log('📸 截图2: 球体弹跳');
    const shot2 = await page.screenshot();
    writeFileSync(`${ARTIFACT_DIR}/afterimage-2-bounce.png`, shot2);
    console.log(`  ${(shot2.length / 1024).toFixed(1)} KB, MD5: ${getMD5(shot2)}`);

    await sleep(5000);  // 让球落下

    // Scenario 3: Dense firing for merge
    console.log('\n场景3: 密集发射');
    await fire(Math.PI / 2 + 0.1, 4000);
    await fire(Math.PI / 2 - 0.3, 5000);

    console.log('📸 截图3: 密集残影');
    const shot3 = await page.screenshot();
    writeFileSync(`${ARTIFACT_DIR}/afterimage-3-merge.png`, shot3);
    console.log(`  ${(shot3.length / 1024).toFixed(1)} KB, MD5: ${getMD5(shot3)}`);

    // Verify
    const md5s = [getMD5(shot1), getMD5(shot2), getMD5(shot3)];
    const unique = new Set(md5s).size;
    console.log(`\n✅ 验证: ${unique}/3 张截图互不相同`);

    if (unique < 3) {
      console.log('⚠️  有重复:');
      md5s.forEach((h, i) => console.log(`  截图${i + 1}: ${h}`));
    }

  } finally {
    await browser.close();
  }
}

main().catch(e => {
  console.error('错误:', e);
  process.exit(1);
});
