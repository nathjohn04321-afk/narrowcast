/*
 * Drives the real app in a real browser and checks the queue behaves:
 * old single notes migrate, several dated notes per video, offline related
 * angles, and the inline player. The server here only serves local files and
 * every other request is blocked, so the offline promise is checked too.
 *
 *   ./tools/app-check/run.sh
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.webmanifest':'application/manifest+json' };

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + label); }
  else { fail++; console.log('FAIL  ' + label + (extra ? '  -> ' + extra : '')); }
}

const server = http.createServer((req, res) => {
  // Block anything leaving the machine; the app must work with no network.
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(r => server.listen(8099, r));
  // Use a preinstalled Chromium when PLAYWRIGHT_CHROMIUM points at one; otherwise
  // let Playwright find the browser it downloaded.
  const exe = process.env.PLAYWRIGHT_CHROMIUM;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });

  // Nothing may reach the internet. Fail loudly if the app tries on its own.
  const outbound = [];
  let playPressed = false;
  await ctx.route('**', route => {
    const u = route.request().url();
    if (u.startsWith('http://localhost:8099')) return route.continue();
    outbound.push({ url: u, afterPlay: playPressed });
    return route.abort();
  });

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto('http://localhost:8099/index.html');

  // ---- migration: seed the OLD single-note shape and reload ----
  await page.evaluate(() => {
    localStorage.setItem('narrowcast.v1', JSON.stringify({
      goals: { g1: { name: 'Eco enzyme export', outcome: 'Ship a container', keywords: ['fermentation','export documents'], lang: 'en', dur: 2, created: 1 } },
      sources: {},
      queue: { q1: { goalId: 'g1', vid: 'dQw4w9WgXcQ', wasShort: false, title: 'Fermentation basics walkthrough', note: 'an older single note', done: false, created: 1000 } },
      config: { activeGoalId: 'g1' }
    }));
  });
  await page.reload();

  const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('narrowcast.v1')).queue.q1);
  check('old note string became a dated note', Array.isArray(migrated.notes) && migrated.notes.length === 1 && migrated.notes[0].text === 'an older single note', JSON.stringify(migrated.notes));
  check('legacy note field removed', !('note' in migrated), JSON.stringify(Object.keys(migrated)));

  // ---- the queue item renders with the new controls ----
  await page.waitForSelector('#queueList .item');
  const labels = await page.$$eval('#queueList .itemacts button', bs => bs.map(b => b.textContent.trim()));
  check('item has Play here / Open in YouTube / Notes / Related / Remove',
    labels.join('|') === 'Play here|Open in YouTube|Notes (1)|Related|Remove', labels.join('|'));

  // ---- notes: several per video ----
  await page.click('#queueList .itemacts button:nth-child(3)');   // Notes
  await page.waitForSelector('#queueList .noterow');
  check('migrated note is listed', (await page.$$('#queueList .noterow')).length === 1);

  await page.fill('#queueList .panel textarea', 'second note from the test');
  await page.click('#queueList >> text=Add note');
  await page.waitForFunction(() => document.querySelectorAll('#queueList .noterow').length === 2);
  check('a second note can be added', (await page.$$('#queueList .noterow')).length === 2);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('narrowcast.v1')).queue.q1.notes);
  check('both notes persisted to storage', stored.length === 2 && stored.some(n => n.text === 'second note from the test'), JSON.stringify(stored.map(n => n.text)));
  check('note button shows the count', (await page.$eval('#queueList .itemacts button:nth-child(3)', b => b.textContent.trim())) === 'Notes (2)');

  // delete one
  await page.click('#queueList .noterow .btn.danger');
  await page.waitForFunction(() => document.querySelectorAll('#queueList .noterow').length === 1);
  check('a note can be deleted', (await page.$$('#queueList .noterow')).length === 1);

  // ---- suggestions: offline, derived from title + focus ----
  await page.click('#queueList .itemacts button:nth-child(4)');   // Related
  await page.waitForSelector('#queueList .sugg');
  const suggs = await page.$$eval('#queueList .sugg strong', ss => ss.map(s => s.textContent.trim()));
  check('six related searches are offered', suggs.length === 6, String(suggs.length));
  check('suggestions use the video title words', suggs.some(s => /fermentation|walkthrough|basics/i.test(s)), suggs.join(' / '));
  check('suggestions are all distinct', new Set(suggs).size === suggs.length);

  const before = suggs.join('|');
  await page.click('#queueList >> text=Different set');
  await page.waitForTimeout(150);
  const after = (await page.$$eval('#queueList .sugg strong', ss => ss.map(s => s.textContent.trim()))).join('|');
  check('Different set changes the list', before !== after, 'identical');

  // ---- inline player ----
  check('no iframe before pressing play', (await page.$$('#queueList iframe')).length === 0);
  playPressed = true;
  await page.click('#queueList .itemacts button:nth-child(1)');   // Play here
  await page.waitForSelector('#queueList iframe');
  const src = await page.$eval('#queueList iframe', f => f.getAttribute('src'));
  check('player embeds the right video', src.includes('/embed/dQw4w9WgXcQ'), src);
  check('player uses the no-cookie host', src.startsWith('https://www.youtube-nocookie.com/'), src);
  check('player limits related videos', src.includes('rel=0'), src);
  check('play button became Stop', (await page.$eval('#queueList .itemacts button:nth-child(1)', b => b.textContent.trim())) === 'Stop');

  // notes stay usable while the player is up, and must not restart it
  await page.click('#queueList .itemacts button:nth-child(3)');   // Notes open
  await page.fill('#queueList .panel textarea', 'written while watching');
  await page.click('#queueList >> text=Add note');
  await page.waitForFunction(() => document.querySelectorAll('#queueList .noterow').length === 2);
  check('player survives adding a note', (await page.$$('#queueList iframe')).length === 1);

  await page.click('#queueList .itemacts button:nth-child(1)');   // Stop
  check('stopping removes the iframe', (await page.$$('#queueList iframe')).length === 0);

  // ---- ticking watched must not wipe notes ----
  await page.click('#queueList .tick');
  await page.waitForTimeout(100);
  const afterTick = await page.evaluate(() => JSON.parse(localStorage.getItem('narrowcast.v1')).queue.q1);
  check('watched flag saved', afterTick.done === true);
  check('notes intact after ticking watched', afterTick.notes.length === 2, JSON.stringify(afterTick.notes.map(n => n.text)));

  // ---- survives a reload ----
  await page.reload();
  await page.waitForSelector('#queueList .item');
  check('note count survives reload', (await page.$eval('#queueList .itemacts button:nth-child(3)', b => b.textContent.trim())) === 'Notes (2)');

  // ---- the original launcher still works ----
  await page.click('#angleBtn');
  await page.waitForSelector('#angleBox .angle');
  check('Build search angles still produces 8', (await page.$$('#angleBox .angle')).length === 8);

  check('no uncaught page errors', errors.length === 0, errors.join(' | '));
  // The only call the app makes by itself is the Google Fonts stylesheet, which
  // degrades to system fonts offline. YouTube must be touched only after Play here.
  const host = u => new URL(u).host;
  const beforePlay = outbound.filter(o => !o.afterPlay).map(o => host(o.url));
  const ytBeforePlay = beforePlay.filter(h => h.includes('youtube'));
  const unexpected = beforePlay.filter(h => h !== 'fonts.googleapis.com' && h !== 'fonts.gstatic.com');

  check('no YouTube contact before pressing play', ytBeforePlay.length === 0, ytBeforePlay.join(', '));
  check('nothing but Google Fonts leaves on its own', unexpected.length === 0, unexpected.join(', '));
  check('pressing play does reach the no-cookie host',
    outbound.some(o => o.afterPlay && host(o.url) === 'www.youtube-nocookie.com'),
    'embed never requested');

  console.log('\noutbound hosts before play: ' + ([...new Set(beforePlay)].join(', ') || 'none'));
  console.log('outbound hosts after play:  ' + ([...new Set(outbound.filter(o => o.afterPlay).map(o => host(o.url)))].join(', ') || 'none'));

  await browser.close();
  server.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
