/*
 * Checks the parts that talk to the YouTube Data API, against a mocked API so no
 * key and no network are needed. Covers: the app stays hands-off without a key,
 * the channel preview, Shorts actually being dropped by real duration, in-app
 * search, queueing from a list, inline playback, and the error messages.
 *
 *   ./tools/app-check/run.sh
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + label); }
  else { fail++; console.log('FAIL  ' + label + (extra ? '  -> ' + extra : '')); }
}

// Five uploads. Two are Shorts by duration and must never reach the screen.
const FIXTURE = [
  { id: 'vidlong1', title: 'Fermentation start to finish', dur: 'PT42M10S' },
  { id: 'vidshort1', title: 'QUICK TIP shorts clip', dur: 'PT45S' },
  { id: 'vidlong2', title: 'Export paperwork explained', dur: 'PT21M3S' },
  { id: 'vidshort2', title: 'another short one', dur: 'PT2M30S' },
  { id: 'vidmed1', title: 'Bottling without contamination', dur: 'PT8M12S' }
];

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(r => server.listen(8096, r));
  const exe = process.env.PLAYWRIGHT_CHROMIUM;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport: { width: 430, height: 950 } });

  const calls = [];
  let failMode = null;

  await ctx.route('**', route => {
    const url = route.request().url();
    if (url.startsWith('http://localhost:8096')) return route.continue();

    if (url.startsWith('https://youtube.googleapis.com/')) {
      const u = new URL(url);
      const kind = u.pathname.replace('/youtube/v3/', '');
      calls.push(kind);

      if (failMode) {
        return route.fulfill({
          status: failMode.status,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'nope', errors: [{ reason: failMode.reason }] } })
        });
      }

      let body = { items: [] };
      if (kind === 'channels') {
        body = { items: [{ id: 'UCabc', snippet: { title: 'Ferment Lab' }, contentDetails: { relatedPlaylists: { uploads: 'UUabc' } } }] };
      } else if (kind === 'playlistItems') {
        body = { items: FIXTURE.map(v => ({ snippet: { title: v.title, channelTitle: 'Ferment Lab', publishedAt: '2026-09-01T00:00:00Z', resourceId: { videoId: v.id } } })) };
      } else if (kind === 'search') {
        body = { items: FIXTURE.map(v => ({ id: { videoId: v.id }, snippet: { title: v.title, channelTitle: 'Ferment Lab', publishedAt: '2026-09-01T00:00:00Z' } })) };
      } else if (kind === 'videos') {
        const ids = (u.searchParams.get('id') || '').split(',');
        body = { items: FIXTURE.filter(v => ids.includes(v.id)).map(v => ({ id: v.id, snippet: { title: v.title, channelTitle: 'Ferment Lab', publishedAt: '2026-09-01T00:00:00Z' }, contentDetails: { duration: v.dur } })) };
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }

    // Fonts, thumbnails, the player: nothing else should be needed to pass.
    return route.abort();
  });

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://localhost:8096/index.html');

  async function seed(withKey) {
    await page.evaluate(k => {
      localStorage.setItem('narrowcast.v1', JSON.stringify({
        goals: { g1: { name: 'Eco enzyme export', outcome: 'Ship a container', keywords: ['fermentation'], lang: 'any', dur: 2, created: 1 } },
        sources: { s1: { goalId: 'g1', label: '@fermentlab', url: 'https://www.youtube.com/@fermentlab/videos', created: 2 } },
        queue: {},
        config: { activeGoalId: 'g1', apiKey: k }
      }));
    }, withKey);
    await page.reload();
    await page.waitForSelector('#sourceList .item');
  }

  // ---------- without a key, nothing changes ----------
  await seed('');
  check('no key: search button says it opens YouTube',
    (await page.$eval('#goBtn', b => b.textContent.trim())) === 'Open on YouTube');
  check('no key: no Browse button on a channel',
    (await page.$$eval('#sourceList .itemacts button', bs => bs.map(b => b.textContent.trim()))).indexOf('Browse') === -1);
  check('no key: the app asks for one', (await page.$eval('#keyPrompt', p => p.textContent)).length > 0);
  check('no key: nothing was requested from the API', calls.length === 0, calls.join(','));

  // ---------- with a key ----------
  await seed('FAKEKEY123');
  check('key: search button says Search', (await page.$eval('#goBtn', b => b.textContent.trim())) === 'Search');
  check('key: an explicit Open this on YouTube button exists',
    await page.$eval('#ytBtn', b => !b.classList.contains('hidden')));
  check('key: still nothing requested before any tap', calls.length === 0, calls.join(','));

  // ---------- channel preview ----------
  await page.click('#sourceList .itemacts button:nth-child(1)');
  await page.waitForSelector('#sourceList .vid');
  const shown = await page.$$eval('#sourceList .vttl', ts => ts.map(t => t.textContent.trim()));
  check('channel preview lists the long videos', shown.length === 3, shown.join(' | '));
  check('Shorts are dropped by real duration',
    !shown.some(t => /shorts clip|another short/i.test(t)), shown.join(' | '));
  check('durations are shown', (await page.$$eval('#sourceList .len', ls => ls.map(l => l.textContent.trim()))).join(',') === '42:10,21:03,8:12',
    (await page.$$eval('#sourceList .len', ls => ls.map(l => l.textContent.trim()))).join(','));
  check('channel title replaced the handle',
    (await page.$eval('#sourceList .ttl', t => t.textContent.trim())) === 'Ferment Lab');

  const uploadsCached = await page.evaluate(() => JSON.parse(localStorage.getItem('narrowcast.v1')).sources.s1.uploads);
  check('uploads playlist cached for next time', uploadsCached === 'UUabc', String(uploadsCached));

  // ---------- play inside the app ----------
  check('no player before pressing play', (await page.$$('#sourceList iframe')).length === 0);
  await page.click('#sourceList .vid:first-of-type .vacts button:nth-child(1)');
  await page.waitForSelector('#sourceList iframe');
  const src = await page.$eval('#sourceList iframe', f => f.getAttribute('src'));
  check('plays the right video in the app', src.includes('/embed/vidlong1'), src);
  check('uses the no-cookie host', src.startsWith('https://www.youtube-nocookie.com/'), src);

  // ---------- queue straight from the list, title filled in ----------
  await page.click('#sourceList .vid:first-of-type .vacts button:nth-child(2)');
  await page.waitForSelector('#queueList .item');
  const queued = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('narrowcast.v1')).queue)[0]);
  check('queued with the real title, no typing', queued && queued.title === 'Fermentation start to finish', JSON.stringify(queued && queued.title));
  check('queued the right video id', queued && queued.vid === 'vidlong1');
  check('player kept running while queueing', (await page.$$('#sourceList iframe')).length === 1);

  await page.click('#sourceList .vid:first-of-type .vacts button:nth-child(2)');
  check('queueing the same video twice is refused',
    (await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('narrowcast.v1')).queue).length)) === 1);

  // ---------- search stays in the app ----------
  await page.fill('#q', 'fermentation ratio');
  await page.click('#goBtn');
  await page.waitForSelector('#results .vid');
  const results = await page.$$eval('#results .vttl', ts => ts.map(t => t.textContent.trim()));
  check('search shows results in the app', results.length === 3, results.join(' | '));
  check('search drops Shorts too', !results.some(t => /shorts clip|another short/i.test(t)), results.join(' | '));
  check('search used the search endpoint', calls.includes('search'));

  const popups = [];
  page.on('popup', p => popups.push(p.url()));
  check('searching did not open YouTube', popups.length === 0, popups.join(','));

  // ---------- the doors stay, and stay honest ----------
  const doors = await page.$$eval('#secDoors a.door', as => as.map(a => a.href));
  check('the four doors are still there', doors.length === 4, String(doors.length));
  check('doors still point at YouTube', doors.every(h => h.includes('youtube.com')));
  check('doors are labelled as leaving the app',
    /leave the app/i.test(await page.$eval('#secDoors .hint', p => p.textContent)));

  // ---------- the layout holds with thumbnails on small screens ----------
  for (const w of [320, 360, 390, 430]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(100);
    const m = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth
    }));
    check('no sideways scroll at ' + w + 'px', m.scroll <= m.client + 1, m.scroll + ' vs ' + m.client);
  }
  await page.setViewportSize({ width: 430, height: 950 });

  // ---------- errors say something useful ----------
  failMode = { status: 403, reason: 'quotaExceeded' };
  await page.fill('#q', 'another search');
  await page.click('#goBtn');
  await page.waitForSelector('#results .fail');
  check('quota message is plain english',
    /allowance/i.test(await page.$eval('#results .fail', p => p.textContent)),
    await page.$eval('#results .fail', p => p.textContent));

  failMode = { status: 400, reason: 'keyInvalid' };
  await page.click('#goBtn');
  await page.waitForFunction(() => /rejected/i.test((document.querySelector('#results .fail') || {}).textContent || ''));
  check('bad key message is plain english', true);

  failMode = null;
  check('no uncaught page errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  server.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
