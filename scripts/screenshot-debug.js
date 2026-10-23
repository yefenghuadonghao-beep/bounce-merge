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
  
  console.log('Navigating to game with debug mode...');
  await page.goto('http://localhost:5173?debug=seed', { 
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  
  console.log('Waiting for debug balls to spawn and settle...');
  // Wait for the delayed call (500ms) plus longer settling time for physics
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('Taking screenshot...');
  await page.screenshot({ 
    path: '/workspace/screenshots/debug-with-fruits.png',
    type: 'png'
  });
  
  console.log('Screenshot saved to /workspace/screenshots/debug-with-fruits.png');
  
  await browser.close();
})();
