#!/usr/bin/env node
/**
 * Pre-deploy page check for the Gambling Data Finder.
 *
 * Every page loads its data from JSON at run time, so a broken reference or a
 * malformed literal does not fail loudly: the section simply sits on
 * "Loading..." for ever. Syntax checks cannot see that. This loads each page in
 * headless Chromium and fails if any of the following is true:
 *
 *   - the page logged a console error, or threw
 *   - a fetch returned a non-2xx status
 *   - any element still reads "Loading..." after the page settles
 *   - an expected marker string is missing from the rendered DOM
 *
 * Setup, once:
 *     npm install
 *     npx playwright install chromium
 *
 * Run:
 *     node scripts/check_pages.js            # all pages
 *     node scripts/check_pages.js index.html # one page
 *
 * Exits non-zero on any failure, so it can gate a deploy.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8123;

// page -> substrings that must appear in the rendered body once data has loaded.
// These are deliberately about rendered output, not source, so they only pass if
// the JavaScript actually ran.
const PAGES = {
  'index.html':            ['studies', 'variables'],
  'studies.html':          ['variables'],
  'search.html':           ['All roles'],
  'explore.html':          [],
  'measures.html':         ['PGSI'],
  'coverage.html':         ['Gambling measures'],
  'study.html?id=QLS':     ['Quinte', 'Gambling measures'],
  'new-analysis.html':     ['High readiness', 'Compat.'],
  'analysis-ideas.html':   ['studies flagged', 'Candidate question'],
  'compare.html':          [],
  'special-datasets.html': [],
  'about.html':            ['full age range'],
  'faq.html':              ['gambling participation or gambling harm'],
  'howto.html':            [],
  'visualisations.html':   [],
  'basket.html':           [],
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.svg': 'image/svg+xml', '.csv': 'text/csv',
               '.png': 'image/png', '.ico': 'image/x-icon', '.xml': 'application/xml',
               '.txt': 'text/plain' };

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); return res.end('not found');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(PORT, () => resolve(srv));
  });
}

// Chrome logs a console error for a favicon it cannot fetch, and for the
// cosmetic font request; neither indicates a broken page.
const IGNORE = [/favicon/i, /net::ERR_ABORTED.*\.ico/i];

(async () => {
  const only = process.argv[2];
  const targets = only ? Object.keys(PAGES).filter(p => p.startsWith(only)) : Object.keys(PAGES);
  if (!targets.length) { console.error('no page matches ' + only); process.exit(2); }

  const srv = await serve();
  const browser = await chromium.launch();
  let failures = 0;

  for (const page of targets) {
    const ctx = await browser.newContext();
    const tab = await ctx.newPage();
    const errors = [];
    tab.on('console', m => { if (m.type() === 'error' && !IGNORE.some(r => r.test(m.text()))) errors.push('console: ' + m.text()); });
    tab.on('pageerror', e => errors.push('threw: ' + e.message));
    tab.on('response', r => { if (r.status() >= 400 && !IGNORE.some(x => x.test(r.url()))) errors.push('HTTP ' + r.status() + ' ' + r.url().replace('http://localhost:' + PORT, '')); });

    try {
      await tab.goto(`http://localhost:${PORT}/${page}`, { waitUntil: 'networkidle', timeout: 60000 });
      await tab.waitForTimeout(700);          // let post-fetch rendering settle
      // CSS uppercases table headers, so compare case-insensitively
      const body = (await tab.innerText('body')).toLowerCase();

      const stuck = await tab.$$eval('.loading', els =>
        els.filter(e => e.offsetParent !== null && /loading/i.test(e.textContent)).map(e => e.textContent.trim()));
      stuck.forEach(s => errors.push('still loading: "' + s + '"'));

      for (const marker of PAGES[page]) {
        if (!body.includes(marker.toLowerCase())) errors.push('missing expected text: "' + marker + '"');
      }
    } catch (e) {
      errors.push('navigation failed: ' + e.message.split('\n')[0]);
    }

    if (errors.length) {
      failures++;
      console.log('FAIL  ' + page);
      errors.slice(0, 6).forEach(e => console.log('        ' + e));
      if (errors.length > 6) console.log('        ...and ' + (errors.length - 6) + ' more');
    } else {
      console.log('ok    ' + page);
    }
    await ctx.close();
  }

  await browser.close();
  srv.close();
  console.log('\n' + (failures ? failures + ' of ' + targets.length + ' pages FAILED' : 'all ' + targets.length + ' pages OK'));
  process.exit(failures ? 1 : 0);
})();
