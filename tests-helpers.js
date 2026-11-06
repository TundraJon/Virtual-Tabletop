/*
 * tests-helpers.js: shared plumbing for the throwaway Playwright test scripts (Node). It holds NO test scenarios.
 * Test scripts themselves live in the scratchpad and are never committed (see CLAUDE.md).
 *
 * Use from a scratchpad script:
 *   NODE_PATH=$(npm root -g) timeout 170 node my-test.js
 *
 *   const T = require('/home/user/virtual-tabletop/tests-helpers.js');
 *   T.run(async () => {
 *     const t0 = Date.now(), c = T.checker();
 *     const bad = T.preflight(ROOT); if (bad.length) { console.log('PREFLIGHT', bad); return; }   // about 1 second
 *     const srv = T.serve(ROOT, 8150);
 *     const s = await T.launch({ width: 412, height: 800, reducedMotion: true });                // short 4 s timeouts
 *     await s.page.goto(srv.url + '/index.html'); await T.waitSplash(s.page);
 *     await T.force(s.page, [2, 4]);                                                              // next two random draws
 *     c.chk('label', expected, actual);                                                           // prints only failures
 *     await s.browser.close(); srv.close(); c.done(s.errors, t0);                                // one summary line
 *   });
 */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), zlib = require('zlib');

// ---- Before the browser: catches most silly errors in about a second ----
function preflight(root) {
  const problems = [];
  let js = '';
  try { js = fs.readFileSync(path.join(root, 'script.js'), 'utf8'); new Function(js); } catch (e) { problems.push('script.js: ' + e.message); }
  if (/[^\x00-\x7F]/.test(js)) problems.push('script.js has raw non-ASCII characters (write them as \\u escapes)');
  let html = '';
  try { html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'); } catch (e) { problems.push('index.html: ' + e.message); }
  ['styles.css', 'script.js'].forEach(f => { if (!new RegExp(f.replace('.', '\\.') + '\\?v=\\d+').test(html)) problems.push('index.html has no ?v=N on ' + f); });
  return problems;
}
// The cache-bust numbers currently in index.html, for Build Log entries
function versions(root) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), v = (f) => { const m = new RegExp(f.replace('.', '\\.') + '\\?v=(\\d+)').exec(html); return m ? Number(m[1]) : null; };
  return { styles: v('styles.css'), script: v('script.js') };
}

// ---- A tiny static server (no dev server to start) ----
function serve(root, port) {
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
  const base = path.resolve(root);
  const srv = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html', f = path.resolve(base, rel);
    if (!f.startsWith(base)) { r.writeHead(403); r.end(); return; }
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); } });
  }).listen(port);
  return { url: 'http://localhost:' + port, close: () => srv.close() };
}

// ---- Browser: short timeouts, error collection, dialogs, forced randomness ----
const RANDOM_STUB = () => { // window.__force = [n, ...] makes the next crypto.getRandomValues(Uint32Array) results those numbers
  window.__force = []; const real = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (a) => { if (window.__force.length && a instanceof Uint32Array) { a[0] = window.__force.shift(); return a; } return real(a); };
};
const force = (page, values) => page.evaluate((v) => { window.__force = v; }, values);

// Options: width, height, touch (default true), dsf, reducedMotion, timeout (ms, default 4000), downloads, forceRandom (default true),
// blockStorage (a key prefix: reading or writing those localStorage keys throws, to test "storage refused")
async function newContext(browser, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: { width: o.width || 412, height: o.height || 800 }, hasTouch: o.touch !== false, deviceScaleFactor: o.dsf || 1, reducedMotion: o.reducedMotion ? 'reduce' : 'no-preference', acceptDownloads: !!o.downloads });
  if (o.forceRandom !== false) await ctx.addInitScript(RANDOM_STUB);
  if (o.blockStorage) await ctx.addInitScript((p) => {
    const g = Storage.prototype.getItem, s = Storage.prototype.setItem;
    Storage.prototype.getItem = function (k) { if (String(k).startsWith(p)) throw new Error('blocked'); return g.call(this, k); };
    Storage.prototype.setItem = function (k, v) { if (String(k).startsWith(p)) throw new Error('blocked'); return s.call(this, k, v); };
  }, o.blockStorage);
  const page = await ctx.newPage(); page.setDefaultTimeout(o.timeout || 4000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const dialogs = { confirm: true, prompt: '', log: [] }; // change dialogs.confirm / dialogs.prompt between steps
  page.on('dialog', d => { dialogs.log.push(d.type() + ': ' + d.message()); if (d.type() === 'confirm') (dialogs.confirm ? d.accept() : d.dismiss()); else d.accept(dialogs.prompt); });
  return { browser, ctx, page, errors, dialogs };
}
async function launch(o) { const { chromium } = require('playwright'); return newContext(await chromium.launch(), o); }

// The splash screen fades after about 3 seconds; wait for it before screenshots or pixel checks
const waitSplash = (page) => page.waitForFunction(() => { const s = document.getElementById('splash'); return !s || getComputedStyle(s).opacity === '0'; }, null, { timeout: 6000 });

// ---- Real touch gestures through the browser's touch API ----
// Note: lifting the finger sends a click that closes a long-press menu, so pick menu items inside longPress's fn (finger still down).
async function touchTools(ctx, page) {
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y })) });
  const longPress = async (x, y, fn) => { await touch('touchStart', [[x, y]]); await page.waitForTimeout(750); const r = fn ? await fn() : undefined; await touch('touchEnd', []); await page.waitForTimeout(80); return r; };
  const drag = async (x1, y1, x2, y2, hold) => { await touch('touchStart', [[x1, y1]]); await touch('touchMove', [[(x1 + x2) / 2, (y1 + y2) / 2]]); await touch('touchMove', [[x2, y2]]); if (!hold) await touch('touchEnd', []); };
  return { touch, longPress, drag };
}

// ---- Reading what is on screen ----
const px = (page, x, y, sel) => page.evaluate(([x, y, sel]) => Array.from(document.querySelector(sel).getContext('2d').getImageData(x, y, 1, 1).data).slice(0, 3), [x, y, sel || '#battleMap']);
const near = (a, b, d) => a.every((v, i) => Math.abs(v - b[i]) <= (d === undefined ? 8 : d));

// ---- Checks: print only failures, then one summary line ----
function checker() {
  let passes = 0, fails = 0;
  const chk = (label, expected, actual) => { const ok = JSON.stringify(expected) === JSON.stringify(actual); ok ? passes++ : fails++; if (!ok) console.log('FAIL ' + label + ' (expect ' + JSON.stringify(expected) + '): ' + JSON.stringify(actual)); };
  const chkT = (label, cond, info) => { cond ? passes++ : fails++; if (!cond) console.log('FAIL ' + label + ': ' + JSON.stringify(info)); };
  const done = (errors, t0) => { console.log('PASS ' + passes + '  FAIL ' + fails + '  JS errors: ' + JSON.stringify(errors || []) + '  (' + Math.round((Date.now() - t0) / 1000) + 's)'); return fails === 0 && !(errors && errors.length); };
  return { chk, chkT, done };
}

// ---- Test files: a flat-color PNG of any size, written without extra tools ----
function png(file, w, h, rgb) {
  const table = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = table[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.concat([Buffer.from(type), data]), len = Buffer.alloc(4), cs = Buffer.alloc(4); len.writeUInt32BE(data.length); cs.writeUInt32BE(crc(t)); return Buffer.concat([len, t, cs]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

// ---- Wrapper: hard timeout so a stuck test can never run for 15 minutes ----
async function run(main, ms) {
  const timer = setTimeout(() => { console.log('HARD TIMEOUT: the test ran past ' + Math.round((ms || 170000) / 1000) + 's'); process.exit(2); }, ms || 170000);
  try { await main(); } catch (e) { console.log('ERROR: ' + String(e.message).split('\n')[0]); process.exitCode = 1; }
  clearTimeout(timer); process.exit(process.exitCode || 0);
}

module.exports = { preflight, versions, serve, newContext, launch, force, waitSplash, touchTools, px, near, checker, png, run, RANDOM_STUB };
