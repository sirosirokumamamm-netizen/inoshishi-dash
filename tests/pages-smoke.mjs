import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Simulate a GitHub Pages project URL: assets must resolve below /inoshishi-dash/.
const root = resolve('dist');
const prefix = '/inoshishi-dash/';
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.woff':'font/woff', '.woff2':'font/woff2' };
const server = createServer(async (req,res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!path.startsWith(prefix)) { res.writeHead(404).end(); return; }
    const file = resolve(root, decodeURIComponent(path.slice(prefix.length)) || 'index.html');
    if (!file.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser = await chromium.launch({headless:true, ...(existsSync('/usr/bin/chromium') ? {executablePath:'/usr/bin/chromium'} : {}), args:['--no-sandbox']});
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>errors.push(r.url()));
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(`http://127.0.0.1:${server.address().port}${prefix}`);
  await page.getByRole('button',{name:'プレイする'}).click();
  await page.evaluate(()=>document.fonts.ready);
  const r=await page.locator('#game').boundingBox();
  await page.mouse.move(r.x+100/600*r.width,r.y+235/700*r.height);
  await page.mouse.down();
  await page.mouse.move(r.x+500/600*r.width,r.y+235/700*r.height,{steps:8});
  await page.mouse.up();
  assert.equal(await page.locator('#shots').textContent(),'04');
  assert.equal(await page.locator('#cleared').textContent(),'33');
  assert.deepEqual(errors,[]);
  console.log('GitHub Pages subpath: local assets, fonts and real slicing passed.');
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
