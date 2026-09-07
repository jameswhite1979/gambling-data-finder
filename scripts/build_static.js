#!/usr/bin/env node
/**
 * Bake the shared header, footer and study-card grids into the static pages.
 *
 * Purpose
 *   Every page of the Gambling Data Finder used to render its navigation, its footer
 *   and (on index.html and studies.html) the dataset cards with JavaScript at load
 *   time, so the raw HTML a crawler fetches carried none of the site's internal
 *   links. This script runs the same rendering functions from app.js in Node and
 *   writes their output into each page between marker comments, so the HTML is
 *   complete before any script runs. mountChrome() in app.js still renders the
 *   chrome client-side when a block is missing, so a page keeps working even if
 *   this build is skipped.
 *
 * Inputs (all read from the repository root, or from --root)
 *   app.js                 renderNav(), renderFooter(), renderStudyGrid()
 *   data/datasets.json     one card per record
 *   data/study_stats.json  per-study variable and gambling counts (studies.html)
 *   data/summary.json      last_updated, shown in the footer
 *   *.html                 every root-level page, in name order
 *
 *   The homepage metric cards and the studies.html summary line are also baked,
 *   by element id rather than by marker pair (see TEXT_BAKES), from the same
 *   summary.json / datasets.json the browser code reads.
 *
 * Marker contract
 *   Each block lives between a pair of comments that this script owns:
 *     <!-- build_static:header -->        ... <!-- /build_static:header -->
 *     <!-- build_static:footer -->        ... <!-- /build_static:footer -->
 *     <!-- build_static:studies-grid -->  ... <!-- /build_static:studies-grid -->
 *   A pair may sit inside a container (<div id="header">...</div>) or directly in
 *   <body> (basket.html, whose header must be a direct child of <body> to stay
 *   sticky). On a page with no pair yet, an EMPTY container - <div id="header">,
 *   <div id="site-header">, <div id="footer">, <div id="site-footer">, or
 *   <div id="studies-grid"> holding at most a "loading" placeholder - is filled
 *   and the pair is inserted inside it. Everything outside the markers is left
 *   byte for byte as it was, including each page's line endings (CRLF or LF) and
 *   its encoding (UTF-8, no BOM). Never hand-edit the content between the
 *   markers; re-run this script instead.
 *
 *   The highlighted nav link is derived from the page's own mountChrome('<id>')
 *   call, so the static header and the JavaScript fallback can never disagree.
 *   Only index.html and studies.html may carry a studies-grid block.
 *
 * Usage
 *   node scripts/build_static.js             rewrite stale pages
 *   node scripts/build_static.js --check     exit 1 if any page is stale; write nothing
 *   node scripts/build_static.js --root DIR  run against a copy of the repository
 *   node scripts/build_static.js --verbose   report every block on every page
 *
 * Exit codes
 *   0  all pages written or already current
 *   1  --check found a stale page, a UTF-8 BOM, or inconsistent ?v= numbers
 *   2  configuration error (see the message: missing or ambiguous containers,
 *      a page still calling renderNav() directly, an active id that matches no
 *      nav link, a missing or duplicated text-bake element, unreadable data, or
 *      app.js failing to load in the sandbox)
 *
 * No npm dependencies: only fs, path and vm from Node itself.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const USAGE = 'usage: node scripts/build_static.js [--check] [--root <dir>] [--verbose]';

// Pages that carry a study-card grid, and the renderStudyGrid() options for each.
const GRID_PAGES = {
  'index.html': { counts: false },
  'studies.html': { counts: true },
};

// Container ids accepted on a first run, per block kind.
const CONTAINER_IDS = {
  header: 'header|site-header',
  footer: 'footer|site-footer',
  'studies-grid': 'studies-grid',
};

// Elements whose text content the browser fills from summary.json (index.html
// metric cards, studies.html summary line). They have no marker pair; each is
// found by id and its text replaced. The page's own JavaScript still writes the
// same values at load, so a stale bake is corrected on screen and reported by
// --check. Values are plain text and are HTML-escaped when written.
const TEXT_BAKES = {
  'index.html': (data, ctx) => ({
    'metric-studies': ctx.formatCount(data.summary.studies),
    'metric-datasets': ctx.formatCount(data.summary.datasets),
    'metric-questionnaires': ctx.formatCount(data.summary.questionnaires),
    'metric-variables': ctx.formatCount(data.summary.variables),
    'metric-gambling': ctx.formatCount(data.summary.gambling_measures),
  }),
  'studies.html': (data, ctx) => ({
    'studies-summary': data.datasets.length + ' studies (' + ctx.formatCount(data.summary.datasets) + ' datasets) with ' +
      ctx.formatCount(data.summary.variables) + ' variables indexed for CYP-GHRIP evidence mapping',
  }),
};

const REQUIRED_FUNCTIONS = ['renderNav', 'renderFooter', 'renderStudyGrid', 'escapeHTML', 'formatCount'];

function OPEN(kind) { return '<!-- build_static:' + kind + ' -->'; }
function CLOSE(kind) { return '<!-- /build_static:' + kind + ' -->'; }

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// An existing marker pair (either layout). Lazy is safe: the close marker is
// unique per kind, and a filled container never matches the EMPTY pattern.
function pairRe(kind) {
  return new RegExp(esc(OPEN(kind)) + '[\\s\\S]*?' + esc(CLOSE(kind)), 'g');
}

// Opening tag of a container div. \s before id=, not \b: \bid= also matches data-id=.
function openTagRe(ids) {
  return '(<div\\b[^>]*\\sid="(?:' + ids + ')"[^>]*>)';
}

// An empty container waiting for its first fill. The grid container may hold the
// "Loading datasets..." placeholder, which the fill removes.
function emptyRe(kind) {
  const ids = CONTAINER_IDS[kind];
  if (kind === 'studies-grid') {
    return new RegExp(openTagRe(ids) + '\\s*(?:<div class="loading">[^<]*<\\/div>\\s*)?(<\\/div>)', 'g');
  }
  return new RegExp(openTagRe(ids) + '\\s*(<\\/div>)', 'g');
}

// The page's chrome call. Exactly one match is required; the second group is the id.
const CHROME_CALL_RE = /\b(?:mountChrome|renderNav)\(\s*(['"])([a-z0-9-]*)\1\s*\)/g;
const RENDER_NAV_RE = /\brenderNav\(/;
const VERSION_RE = /(?:style\.css|app\.js)\?v=(\d+)/g;

function fail(code, message) {
  console.error(message);
  process.exit(code);
}

function count(text, re) {
  return (text.match(re) || []).length;
}

function parseArgs(argv) {
  const opts = { check: false, verbose: false, root: path.resolve(__dirname, '..') };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') opts.check = true;
    else if (a === '--verbose') opts.verbose = true;
    else if (a === '--root') {
      if (!argv[i + 1]) fail(2, '--root needs a directory\n' + USAGE);
      opts.root = path.resolve(argv[++i]);
    } else if (a === '-h' || a === '--help') {
      console.log(USAGE);
      process.exit(0);
    } else fail(2, 'unknown argument ' + a + '\n' + USAGE);
  }
  if (!fs.existsSync(path.join(opts.root, 'app.js'))) fail(2, 'no app.js in ' + opts.root + ' (use --root <repository>)');
  return opts;
}

// Evaluate app.js in a bare vm context with just enough browser surface for its
// top-level statements to run. The render functions are pure string builders.
function loadAppJs(root) {
  const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8').replace(/^\uFEFF/, '');
  const noop = function () {};
  const sandbox = {
    console,
    performance: { now: () => 0 },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    fetch: () => Promise.reject(new Error('fetch is disabled in build_static')),
    document: {
      addEventListener: noop, // app.js registers 'click' and 'DOMContentLoaded' at load
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: () => null,
      createElement: () => ({ classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, appendChild: noop }),
      head: { appendChild: noop },
      body: {},
    },
    URL: { createObjectURL: () => '', revokeObjectURL: noop },
    Blob: function Blob() {},
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  try {
    vm.runInContext(src, ctx, { filename: 'app.js' });
  } catch (e) {
    fail(2, 'app.js could not be evaluated in the build sandbox: ' + e.message +
      '\nOnly browser-free code may run at the top level of app.js; add a stub to the sandbox in scripts/build_static.js if a new global is genuinely needed.');
  }
  REQUIRED_FUNCTIONS.forEach(name => {
    if (typeof ctx[name] !== 'function') fail(2, 'app.js does not define ' + name + '()');
  });
  if ((1234).toLocaleString('en-GB') !== '1,234') fail(2, 'this Node build lacks full ICU; use an official Node release');
  return ctx;
}

function readJSON(root, name) {
  const file = path.join(root, 'data', name);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch (e) {
    fail(2, 'ERROR cannot read data/' + name + ': ' + e.message);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    fail(2, 'ERROR data/' + name + ' is not valid JSON: ' + e.message);
  }
  return null;
}

function loadData(root) {
  const datasets = readJSON(root, 'datasets.json');
  const studyStats = readJSON(root, 'study_stats.json');
  const summary = readJSON(root, 'summary.json');
  if (!Array.isArray(datasets) || !datasets.length ||
      !datasets.every(d => d && typeof d.Dataset_ID === 'string' && d.Dataset_ID)) {
    fail(2, 'ERROR data/datasets.json must be a non-empty array of records that each carry a Dataset_ID');
  }
  if (!studyStats || typeof studyStats !== 'object' || Array.isArray(studyStats)) {
    fail(2, 'ERROR data/study_stats.json must be an object keyed by Dataset_ID');
  }
  if (!summary || !/^\d{4}-\d{2}-\d{2}$/.test(String(summary.last_updated))) {
    fail(2, 'ERROR data/summary.json needs a last_updated date in YYYY-MM-DD form');
  }
  return { datasets, studyStats, summary };
}

function listPages(root) {
  return fs.readdirSync(root).filter(f => f.endsWith('.html')).sort();
}

// Decode strictly, keep the BOM visible so it can be reported, detect the EOL.
function readPage(file, page) {
  const buf = fs.readFileSync(file);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buf);
  } catch (e) {
    fail(2, 'ERROR ' + page + ': not valid UTF-8');
  }
  const hadBom = text.charCodeAt(0) === 0xFEFF;
  if (hadBom) text = text.slice(1);
  const eol = /\r\n/.test(text) ? '\r\n' : '\n';
  return { text, eol, hadBom };
}

function extractActiveId(page, text) {
  if (RENDER_NAV_RE.test(text)) {
    fail(2, 'ERROR ' + page + ": calls renderNav() directly; call mountChrome('<id>') so the static header is not replaced");
  }
  const matches = Array.from(text.matchAll(CHROME_CALL_RE));
  if (matches.length !== 1) {
    fail(2, 'ERROR ' + page + ": expected exactly one mountChrome('<id>') call, found " + matches.length);
  }
  return matches[0][2];
}

function checkActiveId(page, id, ctx) {
  if (!id) return;
  const nav = ctx.renderNav(id);
  if (!/class="active"/.test(nav) && !/nav-basket-link active/.test(nav)) {
    fail(2, 'ERROR ' + page + ": active id '" + id + "' matches no nav link (see renderNav in app.js)");
  }
}

// Normalise a rendered fragment to the page's own line endings.
function toEol(fragment, eol) {
  return String(fragment).replace(/\r\n?/g, '\n').trim().split('\n').join(eol);
}

// Returns { text, mode } or null when the page has neither a pair nor an empty
// container for this kind. Replacers are functions so that $& and friends in a
// nav label, dataset name or access text are never interpreted.
function spliceBlock(page, text, kind, fragment, eol) {
  const pair = pairRe(kind);
  const empty = emptyRe(kind);
  const p = count(text, pair);
  const e = count(text, empty);
  const block = OPEN(kind) + eol + fragment + eol + CLOSE(kind);
  if (p === 1 && e === 0) {
    return { text: text.replace(pair, () => block), mode: 'pair' };
  }
  if (p === 0 && e === 1) {
    return {
      text: text.replace(empty, (m, openTag, closeTag) => openTag + eol + block + eol + closeTag),
      mode: 'container',
    };
  }
  if (p === 0 && e === 0) return null;
  fail(2, 'ERROR ' + page + ': ambiguous ' + kind + ' block: ' + p + ' marker pair(s) and ' + e +
    ' empty container(s); expected exactly one of either');
  return null;
}

function containerHint(kind) {
  return CONTAINER_IDS[kind].split('|').map(id => '<div id="' + id + '">').join(' / ');
}

// A text-only element by id: opening tag, text, matching closing tag. __ID__ is
// replaced by the escaped id before use.
const ID_TEXT_RE = /(<([a-z0-9]+)\b[^>]*\sid="__ID__"[^>]*>)[^<]*(<\/\2>)/;

// Replace the text content of the one element with this id. The element must
// hold text only (no child elements), which is how the placeholders are written.
function bakeText(page, text, id, value) {
  const re = new RegExp(ID_TEXT_RE.source.replace('__ID__', esc(id)), 'g');
  const n = count(text, re);
  if (n !== 1) {
    fail(2, 'ERROR ' + page + ': expected exactly one text-only element with id="' + id + '" (see TEXT_BAKES in scripts/build_static.js), found ' + n);
  }
  return text.replace(re, (m, openTag, tag, closeTag) => openTag + escapeText(value) + closeTag);
}

function escapeText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Rebuild every block on one page. Returns the new text, the kinds whose text
// changed, and per-block details for --verbose.
function buildPage(page, text, eol, ctx, data) {
  const activeId = extractActiveId(page, text);
  checkActiveId(page, activeId, ctx);

  const blocks = [
    ['header', () => ctx.renderNav(activeId)],
    ['footer', () => ctx.renderFooter(data.summary.last_updated)],
  ];
  if (GRID_PAGES[page]) {
    blocks.push(['studies-grid', () => ctx.renderStudyGrid(data.datasets, data.studyStats, GRID_PAGES[page])]);
  } else {
    const p = count(text, pairRe('studies-grid'));
    const e = count(text, emptyRe('studies-grid'));
    if (p || e) {
      fail(2, 'ERROR ' + page + ': carries a studies-grid block but is not listed in GRID_PAGES in scripts/build_static.js');
    }
  }

  const changed = [];
  const details = ['active id ' + JSON.stringify(activeId)];
  for (const [kind, render] of blocks) {
    const fragment = toEol(render(), eol);
    const result = spliceBlock(page, text, kind, fragment, eol);
    if (!result) {
      fail(2, 'ERROR ' + page + ': no ' + OPEN(kind) + ' pair and no empty ' + containerHint(kind) +
        ' container (or the container holds hand-written content)');
    }
    if (result.text !== text) changed.push(kind);
    details.push(kind + ' via ' + result.mode);
    text = result.text;
  }

  const bakes = TEXT_BAKES[page] ? TEXT_BAKES[page](data, ctx) : {};
  Object.keys(bakes).forEach(id => {
    const baked = bakeText(page, text, id, bakes[id]);
    if (baked !== text) changed.push('#' + id);
    details.push('#' + id + ' text');
    text = baked;
  });
  return { text, changed, details };
}

function firstDiffLine(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return a.slice(0, i).split('\n').length;
}

// Every page must reference style.css and app.js with the same ?v= number.
function checkVersions(versions) {
  const tally = {};
  Object.values(versions).forEach(list => list.forEach(v => { tally[v] = (tally[v] || 0) + 1; }));
  const all = Object.keys(tally);
  if (all.length <= 1) return [];
  const majority = all.sort((x, y) => tally[y] - tally[x])[0];
  const odd = [];
  Object.keys(versions).forEach(page => {
    const off = versions[page].filter(v => v !== majority);
    if (off.length) odd.push(page + ' uses ?v=' + Array.from(new Set(off)).join(',') + ' (most pages use ?v=' + majority + ')');
  });
  return odd;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const ctx = loadAppJs(opts.root);
  const data = loadData(opts.root);
  const pages = listPages(opts.root);
  if (!pages.length) fail(2, 'no *.html pages found in ' + opts.root);

  const stale = [];
  const versions = {};
  let written = 0;
  let unchanged = 0;

  for (const page of pages) {
    const file = path.join(opts.root, page);
    const { text, eol, hadBom } = readPage(file, page);
    const built = buildPage(page, text, eol, ctx, data);
    versions[page] = Array.from(text.matchAll(VERSION_RE)).map(m => m[1]);
    if (opts.verbose) console.log('  ' + page + ': ' + built.details.join('; ') + '; eol ' + JSON.stringify(eol));

    if (opts.check) {
      const reasons = [];
      if (hadBom) reasons.push('has a UTF-8 BOM');
      if (built.text !== text) {
        reasons.push(built.changed.join(', ') + ' (first difference at line ' + firstDiffLine(text, built.text) + ')');
      }
      if (reasons.length) {
        stale.push(page);
        console.log('STALE ' + page + ': ' + reasons.join('; '));
      } else {
        console.log('current ' + page);
      }
    } else if (built.text !== text || hadBom) {
      fs.writeFileSync(file, built.text, 'utf8');
      written++;
      const what = built.changed.slice();
      if (hadBom) what.push('fixed BOM');
      console.log('written ' + page + ' (' + what.join(', ') + ')');
    } else {
      unchanged++;
      console.log('unchanged ' + page);
    }
  }

  const oddVersions = checkVersions(versions);
  oddVersions.forEach(line => console.log('VERSION ' + line));

  if (opts.check) {
    if (stale.length) {
      console.log('\nStatic HTML is out of date in ' + stale.length + ' page(s). Run:\n    node scripts/build_static.js\nthen commit the changed .html files.');
    } else {
      console.log('\nAll ' + pages.length + ' pages carry current static blocks.');
    }
    if (oddVersions.length) {
      console.log('The ?v= cache-bust number differs between pages; bump it in every page (see CLAUDE.md).');
    }
    process.exit(stale.length || oddVersions.length ? 1 : 0);
  }

  console.log('\n' + written + ' page(s) written, ' + unchanged + ' unchanged.');
  if (oddVersions.length) console.log('Warning: the ?v= cache-bust number differs between pages; bump it in every page.');
}

main();
