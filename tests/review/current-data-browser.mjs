import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.CHEER_PLAYWRIGHT_PATH || 'playwright');
const root = process.cwd();
let version = 1;
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml' };
const news = () => JSON.stringify([{ id:'review-news', title:'新聞版本' + version, date:'2026/09/07 11:20', tag:'啦啦隊情報', content:'測試新聞', auto:true }]);
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/data/auto-news.json') { res.setHeader('Content-Type','application/json'); res.end(news()); return; }
    if (path === '/data/auto-news-meta.json') {
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify({ updatedAt:'2026-09-07T03:20:00Z', sha256:createHash('sha256').update(news()).digest('hex'), status:'ok' })); return;
    }
    const file = resolve(root, '.' + decodeURIComponent(path === '/' ? '/index.html' : path));
    if (!file.startsWith(root)) throw Error('out of root');
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch (_) { res.statusCode=404; res.end(); }
});
await new Promise(r => server.listen(4187, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath:process.env.CHEER_CHROME_PATH, headless:true });
try {
  for (const width of [1366,390]) {
    const context = await browser.newContext({ viewport:{width,height:900} });
    await context.route('https://docs.google.com/**', route => {
      const gid = new URL(route.request().url()).searchParams.get('gid');
      const csv = gid === '0'
        ? 'realname,nickname,team,sport,nat,note,img\n現役測試,Active,Si-ster,排球,臺灣,,\n離隊測試,Former,Si-ster,排球,臺灣,已離隊,\n'
        : 'title,date\n';
      return route.fulfill({ contentType:'text/csv', body:csv, headers:{'Access-Control-Allow-Origin':'*'} });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:4187/?mode=girls');
    await page.waitForFunction(() => window.dbGirls?.length === 2, {timeout:20000});
    if (await page.locator('#landing-page').isVisible()) {
      await page.locator('#enter-btn').click();
      await page.locator('#landing-page').waitFor({state:'hidden'});
    }
    await page.evaluate(() => {
      localStorage.setItem('cheer_home_team','Si-ster');
      localStorage.setItem('review-personal-sentinel','preserve');
      window.setMode('girls');
      window.toggleFavorite('離隊測試|Former');
    });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('cheer_favorites') || '[]').includes('離隊測試|Former'));
    assert.equal(await page.locator('#grid-container').innerText().then(t=>/former/i.test(t)), false);
    await page.locator('#searchInput').fill('離隊測試');
    await page.evaluate(() => renderGirls());
    assert.match(await page.locator('#grid-container').innerText(), /Former|離隊測試/i);
    await page.evaluate(() => window.openProfile('離隊測試|Former'));
    await page.waitForSelector('.girl-career');
    assert.match(await page.locator('#profile-container').innerText(), /目前無所屬隊伍/);
    await page.locator('.girl-career summary').click();
    assert.match(await page.locator('.girl-career').innerText(), /Si-ster/);
    assert.match(await page.locator('.girl-career').innerText(), /已結束/);
    await page.evaluate(() => window.setMode('news'));
    await page.evaluate(() => window.refreshLatestNews(true));
    await page.waitForFunction(() => document.querySelector('[data-news-updated]')?.textContent.includes('11:20'));
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => window.dbGirls?.length === 2);
    if (await page.locator('#landing-page').isVisible()) {
      await page.locator('#enter-btn').click();
      await page.locator('#landing-page').waitFor({state:'hidden'});
    }
    await page.evaluate(() => window.setMode('news'));
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    version += 1;
    await page.evaluate(() => window.refreshLatestNews(true));
    await page.waitForFunction(v => document.querySelector('#news-container')?.textContent.includes('新聞版本'+v),version);
    await context.setOffline(true);
    const cached = await page.evaluate(async () => (await fetch('data/auto-news.json?t=offline',{cache:'no-store'})).json());
    assert.equal(cached[0].title, '新聞版本'+version);
    assert.equal(await page.evaluate(()=>localStorage.getItem('review-personal-sentinel')), 'preserve');
    assert.equal(await page.evaluate(()=>localStorage.getItem('cheer_home_team')), 'Si-ster');
    assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('cheer_favorites')).includes('離隊測試|Former')));
    await context.setOffline(false);
    const overflow = await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth + 2);
    assert.equal(overflow,false);
    await mkdir('review-artifacts',{recursive:true});
    await page.screenshot({path:'review-artifacts/news-'+width+'.png',fullPage:true});
    console.log(JSON.stringify({width, errors, currentRoster:true, formerProfile:true, career:true, newsRefresh:true, offline:true, personalData:true, overflow}));
    await context.close();
  }
} finally { await browser.close(); server.close(); }
