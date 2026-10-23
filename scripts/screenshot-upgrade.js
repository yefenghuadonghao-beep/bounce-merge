import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 720, height: 1280 });
  
  // Log console messages from the browser
  page.on('console', msg => {
    console.log('BROWSER:', msg.text());
  });
  
  console.log('Navigating to upgrade scene...');
  await page.goto('http://localhost:8080?scene=upgrade', { 
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  
  // Wait for upgrade scene to fully render
  await new Promise(resolve => setTimeout(resolve, 4000));
  
  console.log('Taking screenshot...');
  await page.screenshot({ 
    path: '/workspace/screenshots/upgrade-screen.png',
    type: 'png'
  });
  
  console.log('Screenshot saved to /workspace/screenshots/upgrade-screen.png');
  
  await browser.close();
})();
