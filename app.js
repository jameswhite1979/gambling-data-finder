// ================================================================
// Shared utilities
// ================================================================

async function fetchJSON(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.statusText);
    return await r.json();
  } catch (e) { console.error('Failed to load', url, e); return null; }
}

function escapeHTML(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function truncate(s, n) {
  if (!s || s.length <= n) return s || '';
  return s.substring(0, n) + '…';
}

function makeURL(u) {
  if (!u) return '';
  if (!u.startsWith('http')) u = 'https://' + u;
  return u;
}

function roleBadgeClass(role) {
  if (!role) return 'badge badge-other';
  const r = role.toLowerCase();
  if (r.includes('gambling')) return 'badge badge-gambling';
  if (r.includes('risk') || r.includes('protective')) return 'badge badge-risk';
  if (r.includes('questionnaire') || r === 'question') return 'badge badge-contextual';
  if (r.includes('meta')) return 'badge badge-meta';
  return 'badge badge-other';
}

function accessBadge(type) {
  if (!type) return '';
  const t = type.toLowerCase();
  if (t.includes('open') || t.includes('public')) return '<span class="badge badge-open">Open</span>';
  if (t.includes('contextual')) return '<span class="badge badge-contextual">Contextual</span>';
  return '<span class="badge badge-controlled">Controlled</span>';
}

// ================================================================
// Navigation (shared header + footer)
// ================================================================

function renderNav(activePage) {
  const pages = [
    { id: 'home', label: 'Home', href: 'index.html' },
    { id: 'explore', label: 'Explore', href: 'explore.html' },
    { id: 'visualisations', label: 'Visualisations', href: 'visualisations.html' },
    { id: 'measures', label: 'Measures', href: 'measures.html' },
    { id: 'new-analysis', label: 'Analysis', href: 'new-analysis.html' },
    { id: 'analysis-ideas', label: 'Ideas', href: 'analysis-ideas.html' },
    { id: 'coverage', label: 'Coverage', href: 'coverage.html' },
    { id: 'faq', label: 'FAQs', href: 'faq.html' },
    { id: 'about', label: 'About', href: 'about.html' },
  ];
  const links = pages.map(p =>
    `<a href="${p.href}"${p.id === activePage ? ' class="active"' : ''}>${p.label}</a>`
  ).join('');

  return `<header class="site-header">
  <div class="header-inner">
    <a href="index.html" class="logo"><span class="logo-text">Gambling Data Finder</span></a>
    <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('nav-open');this.setAttribute('aria-expanded',this.classList.contains('open'))">
      <span class="nav-toggle-icon"></span>
    </button>
    <nav>
      ${links}
      <a href="basket.html" class="nav-basket-link${activePage === 'basket' ? ' active' : ''}">
        Basket <span class="basket-badge" id="nav-basket-count"></span>
      </a>
    </nav>
  </div>
</header>`;
}

function renderFooter() {
  return `<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-col">
      <h4>Help</h4>
      <a href="faq.html">FAQs</a>
      <a href="howto.html">How-to guides</a>
      <a href="coverage.html">Dataset coverage</a>
    </div>
    <div class="footer-col">
      <h4>About</h4>
      <a href="about.html">About the CYP-GHRIP data resource</a>
      <a href="studies.html">All studies and datasets</a>
      <a href="special-datasets.html">Special datasets</a>
      <a href="measures.html">Standardised measures</a>
    </div>
    <div class="footer-col">
      <h4>Project</h4>
      <a href="about.html">CYP-GHRIP</a>
      <a href="about.html#contact">Contact</a>
    </div>
  </div>
  <div class="footer-bottom">
    Gambling Data Finder &mdash; Children and Young People Gambling Harm Research and Innovation Partnership (CYP-GHRIP)<br>
    Last updated: <span id="footer-date">&mdash;</span>
  </div>
</footer>`;
}

// ================================================================
// Basket (localStorage) - grouped by type
// ================================================================

function getBasket() {
  try { return JSON.parse(localStorage.getItem('ghripps_basket') || '[]'); } catch { return []; }
}
function saveBasket(b) {
  localStorage.setItem('ghripps_basket', JSON.stringify(b));
  updateBasketCount();
}
function addToBasket(item) {
  const b = getBasket();
  const key = (item.dataset_id||'') + '|' + (item.variable_name||item.title||'') + '|' + (item.wave_year||'') + '|' + (item.item_type||'variable');
  if (!b.find(x => basketKey(x) === key)) { b.push(item); saveBasket(b); }
}
function removeFromBasket(idx) {
  const b = getBasket(); b.splice(idx, 1); saveBasket(b);
}
function basketKey(item) {
  return (item.dataset_id||'') + '|' + (item.variable_name||item.questionnaire_id||item.title||'') + '|' + (item.wave_year||'') + '|' + (item.item_type||'variable');
}
function isInBasket(item) {
  return getBasket().some(x => basketKey(x) === basketKey(item));
}
function updateBasketCount() {
  document.querySelectorAll('#nav-basket-count,.basket-badge').forEach(el => {
    const n = getBasket().length;
    el.textContent = n || '';
    el.setAttribute('data-count', n);
  });
}
function clearBasket() { localStorage.removeItem('ghripps_basket'); updateBasketCount(); }

function getBasketGrouped() {
  const b = getBasket();
  return {
    variables: b.filter(x => (x.item_type||'variable') === 'variable'),
    questions: b.filter(x => x.item_type === 'question'),
    questionnaires: b.filter(x => x.item_type === 'questionnaire'),
  };
}

// ================================================================
// CSV / Excel export
// ================================================================

function basketToCSV(items) {
  if (!items || !items.length) return '';
  const headers = Object.keys(items[0]);
  const rows = [headers.join(',')];
  items.forEach(item => {
    rows.push(headers.map(h => {
      let v = String(item[h] || '').replace(/"/g, '""');
      if (v.includes(',') || v.includes('"') || v.includes('\n')) v = '"' + v + '"';
      return v;
    }).join(','));
  });
  return rows.join('\n');
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadCSV(items, filename) {
  downloadBlob(basketToCSV(items), filename, 'text/csv;charset=utf-8;');
}

function downloadExcel(items, filename) {
  if (!items || !items.length) return;
  const headers = Object.keys(items[0]);
  let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
  xml += '<Worksheet ss:Name="Sheet1"><Table>';
  xml += '<Row>' + headers.map(h => `<Cell><Data ss:Type="String">${escapeHTML(h)}</Data></Cell>`).join('') + '</Row>';
  items.forEach(item => {
    xml += '<Row>' + headers.map(h => `<Cell><Data ss:Type="String">${escapeHTML(String(item[h]||''))}</Data></Cell>`).join('') + '</Row>';
  });
  xml += '</Table></Worksheet></Workbook>';
  downloadBlob(xml, filename, 'application/vnd.ms-excel');
}

// ================================================================
// Dropdown toggle
// ================================================================

function toggleDropdown(el) {
  const dd = el.closest('.dropdown');
  document.querySelectorAll('.dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
  dd.classList.toggle('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.dropdown')) document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
});

// ================================================================
// Search engine (client-side)
// ================================================================

let _variablesCache = null;
async function loadVariables() {
  if (_variablesCache) return _variablesCache;
  _variablesCache = await fetchJSON('data/variables.json');
  return _variablesCache;
}

function searchVariables(variables, query, filters) {
  const t0 = performance.now();
  let results = variables;

  if (query) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    results = results.filter(v => {
      const txt = (
        (v.variable_name||'') + ' ' + (v.variable_label||'') + ' ' +
        (v.question_text||'') + ' ' + (v.title||'') + ' ' +
        (v.questionnaire_title||'') + ' ' + (v.questionnaire_url||'') + ' ' +
        (v.file_type||'') + ' ' + (v.notes||'') + ' ' +
        (v.named_measure||'') + ' ' + (v.dataset_name||'') + ' ' +
        (v.dataset_id||'') + ' ' + (v.construct_category||'') + ' ' +
        (v.risk_domain||'') + ' ' + (v.wave_year||'')
      ).toLowerCase();
      return terms.every(t => txt.includes(t));
    });
  }

  if (filters.role) results = results.filter(v => v.role === filters.role);
  if (filters.dataset) results = results.filter(v => v.dataset_id === filters.dataset);
  if (filters.construct) results = results.filter(v => v.construct_category === filters.construct);
  if (filters.risk_domain) results = results.filter(v => v.risk_domain === filters.risk_domain);
  if (filters.named_measure) results = results.filter(v => v.named_measure === filters.named_measure);
  if (filters.wave_year) results = results.filter(v => v.wave_year === filters.wave_year);
  if (filters.age_group) results = results.filter(v => v.age_group === filters.age_group);

  return { results, elapsed: ((performance.now() - t0) / 1000).toFixed(2) };
}

function questionnaireToSearchItem(q) {
  return {
    item_type: 'questionnaire',
    role: 'Questionnaire',
    questionnaire_id: q['Questionnaire_ID'] || '',
    title: q['Questionnaire / metadata title'] || '',
    questionnaire_title: q['Questionnaire / metadata title'] || '',
    dataset_id: q['Dataset_ID'] || '',
    dataset_name: q['Dataset name'] || q['Dataset_ID'] || '',
    wave_year: q['Wave / year'] || '',
    age_group: q['Age group'] || '',
    construct_category: 'Questionnaire / codebook',
    file_type: q['File type'] || '',
    questionnaire_url: q['URL'] || '',
    variable_url: q['URL'] || '',
    metadata_status: [
      q['Public or gated'] ? 'Access: ' + q['Public or gated'] : '',
      q['Variable names visible?'] ? 'Variable names visible: ' + q['Variable names visible?'] : '',
      q['Question wording visible?'] ? 'Question wording visible: ' + q['Question wording visible?'] : ''
    ].filter(Boolean).join('; '),
    notes: q['Notes'] || ''
  };
}

function variableQuestionToSearchItem(v) {
  return {
    ...v,
    item_type: 'question',
    role: 'Question',
    construct_category: v.construct_category || 'Source question',
    variable_label: v.question_text || v.variable_label || '',
    question_text: v.question_text || v.variable_label || '',
    title: v.question_text || v.variable_label || v.variable_name || ''
  };
}

function buildSearchIndex(variables, questionnaires) {
  const items = [];
  (variables || []).forEach(v => {
    items.push({ ...v, item_type: v.item_type || 'variable' });
    if (v.question_text && v.question_text.trim()) {
      items.push(variableQuestionToSearchItem(v));
    }
  });
  (questionnaires || []).forEach(q => items.push(questionnaireToSearchItem(q)));
  return items;
}

// ================================================================
// Render search results
// ================================================================

function renderResults(container, results, page, perPage) {
  container.innerHTML = '';
  const start = (page - 1) * perPage;
  const slice = results.slice(start, start + perPage);

  if (slice.length === 0) {
    container.innerHTML = '<div class="loading" style="padding:2rem"><p>No results found. Try different keywords or filters.</p></div>';
    return;
  }

  slice.forEach(v => {
    const inB = isInBasket(v);
    const card = document.createElement('div');
    card.className = 'result-card';
    const title = v.item_type === 'questionnaire'
      ? (v.title || v.questionnaire_title || '(untitled questionnaire)')
      : v.item_type === 'question'
        ? (v.question_text || v.variable_label || v.variable_name || '(no question text)')
        : (v.variable_label || v.variable_name || '(no label)');
    card.innerHTML = `
      <div class="result-main">
        <span class="${roleBadgeClass(v.role)}">${escapeHTML(v.role || 'Variable')}</span>
        ${v.construct_category && v.construct_category !== 'Uncategorised' ? `<span class="badge badge-other">${escapeHTML(v.construct_category)}</span>` : ''}
        <br>
        <span class="result-title">${escapeHTML(title)}</span>
        <div class="result-meta">
          ${v.variable_name ? `<span class="result-meta-item"><strong>Var:</strong> ${escapeHTML(v.variable_name)}</span>` : ''}
          ${v.questionnaire_id ? `<span class="result-meta-item"><strong>Questionnaire:</strong> ${escapeHTML(v.questionnaire_id)}</span>` : ''}
          <span class="result-meta-item"><strong>Study:</strong> <a href="study.html?id=${encodeURIComponent(v.dataset_id)}">${escapeHTML(v.dataset_name || v.dataset_id)}</a></span>
          ${v.wave_year ? `<span class="result-meta-item"><strong>Wave:</strong> ${escapeHTML(v.wave_year)}</span>` : ''}
          ${v.named_measure ? `<span class="result-meta-item"><strong>Measure:</strong> ${escapeHTML(v.named_measure)}</span>` : ''}
          ${v.age_group ? `<span class="result-meta-item"><strong>Age:</strong> ${escapeHTML(v.age_group)}</span>` : ''}
          ${v.file_type ? `<span class="result-meta-item"><strong>Type:</strong> ${escapeHTML(v.file_type)}</span>` : ''}
        </div>
      </div>
      <div class="result-actions">
        <button class="btn btn-outline btn-basket-toggle btn-sm ${inB ? 'in-basket' : ''}"
                onclick="toggleBasketBtn(this, ${escapeHTML(JSON.stringify(v))})">${inB ? 'In basket' : '+ Basket'}</button>
      </div>`;
    container.appendChild(card);
  });
}

function toggleBasketBtn(btn, item) {
  if (typeof item === 'string') item = JSON.parse(item);
  if (!item.item_type) item.item_type = 'variable';
  if (isInBasket(item)) {
    const b = getBasket();
    const k = basketKey(item);
    const i = b.findIndex(x => basketKey(x) === k);
    if (i >= 0) removeFromBasket(i);
    btn.textContent = '+ Basket';
    btn.classList.remove('in-basket');
  } else {
    addToBasket(item);
    btn.textContent = 'In basket';
    btn.classList.add('in-basket');
  }
}

function renderPagination(container, total, page, perPage, onPageChange) {
  container.innerHTML = '';
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return;
  const maxShow = 7;
  let s = Math.max(1, page - Math.floor(maxShow / 2));
  let e = Math.min(totalPages, s + maxShow - 1);
  if (e - s < maxShow - 1) s = Math.max(1, e - maxShow + 1);

  if (page > 1) { const b = document.createElement('button'); b.textContent = '← Prev'; b.onclick = () => onPageChange(page - 1); container.appendChild(b); }
  for (let i = s; i <= e; i++) {
    const b = document.createElement('button'); b.textContent = i;
    if (i === page) b.className = 'active';
    b.onclick = () => onPageChange(i); container.appendChild(b);
  }
  if (page < totalPages) { const b = document.createElement('button'); b.textContent = 'Next →'; b.onclick = () => onPageChange(page + 1); container.appendChild(b); }
}

function populateSelect(sel, values, selected, placeholder) {
  sel.innerHTML = `<option value="">${placeholder || 'All'}</option>`;
  (values || []).forEach(v => {
    const o = document.createElement('option'); o.value = v; o.textContent = v;
    if (v === selected) o.selected = true;
    sel.appendChild(o);
  });
}

// ================================================================
// Visualisations (SVG-based)
// ================================================================

function renderBarChart(container, data, colorFn) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  let html = '<div class="bar-chart">';
  data.slice(0, 15).forEach((d, i) => {
    const pct = (d.value / maxVal * 100).toFixed(1);
    const color = colorFn ? colorFn(i) : `hsl(${210 + i * 12}, 60%, 50%)`;
    html += `<div class="bar-row">
      <span class="bar-label" title="${escapeHTML(d.label)}">${escapeHTML(truncate(d.label, 18))}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="bar-val">${d.value.toLocaleString()}</span>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// ================================================================
// A. Waffle chart — role composition
// ================================================================

function renderWaffle(container, roleCounts, total) {
  var roles = Object.keys(roleCounts).sort(function(a, b) { return roleCounts[b] - roleCounts[a]; });
  var colors = { 'Gambling measure': '#d97706', 'Risk/protective factor': '#0d9488', 'Other variable': '#64748b' };
  var cells = 100;
  var grid = [];
  var remaining = cells;
  roles.forEach(function(role, i) {
    var n = Math.round((roleCounts[role] / total) * cells);
    if (i === roles.length - 1) n = remaining;
    for (var j = 0; j < n && grid.length < cells; j++) grid.push(role);
    remaining -= n;
  });
  while (grid.length < cells) grid.push(roles[roles.length - 1]);

  var html = '<div class="waffle-grid">';
  grid.forEach(function(role) {
    var c = colors[role] || '#94a3b8';
    html += '<div class="waffle-cell" style="background:' + c + ';" title="' + escapeHTML(role) + '"></div>';
  });
  html += '</div><div class="waffle-legend">';
  roles.forEach(function(role) {
    var c = colors[role] || '#94a3b8';
    var pct = ((roleCounts[role] / total) * 100).toFixed(1);
    html += '<div class="waffle-legend-item"><span class="waffle-dot" style="background:' + c + ';"></span>' + escapeHTML(role) + ' <span class="waffle-pct">' + pct + '%</span></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// ================================================================
// B. Treemap — construct categories
// ================================================================

function renderTreemap(container, data) {
  var total = data.reduce(function(s, d) { return s + d.value; }, 0);
  var colors = ['#0f172a','#d97706','#0d9488','#e11d48','#6366f1','#059669','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#64748b','#475569','#b45309','#0891b2'];
  var html = '<div class="treemap">';
  data.forEach(function(d, i) {
    var pct = ((d.value / total) * 100).toFixed(1);
    var bg = colors[i % colors.length];
    html += '<div class="treemap-cell" style="flex-basis:' + pct + '%;background:' + bg + ';" title="' + escapeHTML(d.label) + ': ' + d.value.toLocaleString() + ' (' + pct + '%)">';
    if (d.value / total > 0.04) {
      html += '<span class="treemap-label">' + escapeHTML(truncate(d.label, 18)) + '</span>';
      html += '<span class="treemap-val">' + d.value.toLocaleString() + '</span>';
    }
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// ================================================================
// C. Stacked bar — role breakdown per dataset
// ================================================================

function renderStackedBar(container, stackedData, dsOrder) {
  var roles = ['Gambling measure', 'Risk/protective factor', 'Other variable'];
  var colors = { 'Gambling measure': '#d97706', 'Risk/protective factor': '#0d9488', 'Other variable': '#94a3b8' };
  var maxVal = 0;
  dsOrder.forEach(function(ds) {
    var t = 0;
    roles.forEach(function(r) { t += (stackedData[ds] && stackedData[ds][r]) || 0; });
    if (t > maxVal) maxVal = t;
  });

  var html = '<div class="stacked-chart">';
  dsOrder.forEach(function(ds) {
    var total = 0;
    roles.forEach(function(r) { total += (stackedData[ds] && stackedData[ds][r]) || 0; });
    html += '<div class="stacked-row"><span class="stacked-label" title="' + escapeHTML(ds) + '">' + escapeHTML(truncate(ds, 35)) + '</span><div class="stacked-track">';
    roles.forEach(function(r) {
      var val = (stackedData[ds] && stackedData[ds][r]) || 0;
      var pct = (val / maxVal * 100).toFixed(1);
      html += '<div class="stacked-seg" style="width:' + pct + '%;background:' + colors[r] + ';" title="' + escapeHTML(r) + ': ' + val.toLocaleString() + '"></div>';
    });
    html += '</div><span class="stacked-total">' + total.toLocaleString() + '</span></div>';
  });
  html += '</div>';
  html += '<div class="stacked-legend">';
  roles.forEach(function(r) {
    html += '<span class="stacked-legend-item"><span class="waffle-dot" style="background:' + colors[r] + ';"></span>' + escapeHTML(r) + '</span>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// ================================================================
// D. Bubble chart — dataset landscape
// ================================================================

function renderBubble(container, datasets, variables) {
  var varCounts = {};
  if (variables) variables.forEach(function(v) { varCounts[v.dataset_id] = (varCounts[v.dataset_id] || 0) + 1; });

  var accessColors = {
    'Open': '#059669', 'Safeguarded': '#d97706', 'Secure': '#e11d48',
    'Application': '#6366f1', 'Registration': '#0d9488'
  };
  function getAccessColor(d) {
    var access = (d['Access type'] || d['Access difficulty'] || '').toLowerCase();
    if (access.includes('open')) return accessColors['Open'];
    if (access.includes('safe')) return accessColors['Safeguarded'];
    if (access.includes('secure')) return accessColors['Secure'];
    if (access.includes('applic')) return accessColors['Application'];
    if (access.includes('regist')) return accessColors['Registration'];
    return '#64748b';
  }

  var maxVars = Math.max.apply(null, datasets.map(function(d) { return varCounts[d['Dataset_ID']] || 1; }));
  var svgW = 500, svgH = 300;

  var countries = {};
  datasets.forEach(function(d) { var c = d['Country'] || 'Unknown'; countries[c] = true; });
  var countryList = Object.keys(countries).sort();

  var html = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" class="bubble-svg">';
  datasets.forEach(function(d, i) {
    var id = d['Dataset_ID'];
    var n = varCounts[id] || 1;
    var r = Math.max(6, Math.sqrt(n / maxVars) * 35);
    var ci = countryList.indexOf(d['Country'] || 'Unknown');
    var x = 40 + (ci / Math.max(countryList.length - 1, 1)) * (svgW - 80);
    var y = svgH - 30 - (n / maxVars) * (svgH - 60);
    x += (Math.sin(i * 2.7) * 20);
    y += (Math.cos(i * 3.1) * 10);
    x = Math.max(r + 5, Math.min(svgW - r - 5, x));
    y = Math.max(r + 5, Math.min(svgH - r - 5, y));
    var color = getAccessColor(d);
    html += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="' + color + '" opacity="0.7" stroke="#fff" stroke-width="1"><title>' + escapeHTML(d['Dataset name'] || id) + ' (' + n + ' vars, ' + escapeHTML(d['Country'] || '?') + ')</title></circle>';
  });
  html += '</svg>';
  html += '<div class="bubble-legend">';
  Object.keys(accessColors).forEach(function(k) {
    html += '<span class="stacked-legend-item"><span class="waffle-dot" style="background:' + accessColors[k] + ';"></span>' + k + '</span>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// ================================================================
// E. Timeline — data collection periods
// ================================================================

function renderTimeline(container, datasets) {
  var items = [];
  datasets.forEach(function(d) {
    var years = (d['Data collection years'] || d['Years'] || '').toString();
    var matches = years.match(/\d{4}/g);
    if (matches && matches.length > 0) {
      var start = parseInt(matches[0]);
      var end = matches.length > 1 ? parseInt(matches[matches.length - 1]) : start;
      items.push({ name: d['Dataset name'] || d['Dataset_ID'], id: d['Dataset_ID'], start: start, end: end, design: d['Study design'] || '' });
    }
  });
  if (items.length === 0) { container.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;">No timeline data available.</p>'; return; }

  items.sort(function(a, b) { return a.start - b.start || a.end - b.end; });
  var minYear = Math.min.apply(null, items.map(function(d) { return d.start; }));
  var maxYear = Math.max.apply(null, items.map(function(d) { return d.end; }));
  var span = maxYear - minYear || 1;

  var designColors = { 'Longitudinal': '#0d9488', 'Cross-sectional': '#d97706', 'Cohort': '#6366f1', 'Panel': '#e11d48' };
  function getDesignColor(design) {
    var dl = design.toLowerCase();
    if (dl.includes('longitudinal') || dl.includes('cohort')) return '#0d9488';
    if (dl.includes('cross')) return '#d97706';
    if (dl.includes('panel')) return '#6366f1';
    return '#64748b';
  }

  var html = '<div class="timeline-chart">';
  html += '<div class="timeline-axis">';
  for (var y = minYear; y <= maxYear; y += Math.max(1, Math.round(span / 8))) {
    var left = ((y - minYear) / span * 100).toFixed(1);
    html += '<span class="timeline-tick" style="left:' + left + '%;">' + y + '</span>';
  }
  html += '</div>';
  items.forEach(function(item) {
    var left = ((item.start - minYear) / span * 100).toFixed(1);
    var width = (((item.end - item.start) || 0.5) / span * 100).toFixed(1);
    width = Math.max(parseFloat(width), 1).toFixed(1);
    var color = getDesignColor(item.design);
    html += '<div class="timeline-row">';
    html += '<span class="timeline-label" title="' + escapeHTML(item.name) + '">' + escapeHTML(truncate(item.name, 25)) + '</span>';
    html += '<div class="timeline-track"><div class="timeline-bar" style="left:' + left + '%;width:' + width + '%;background:' + color + ';" title="' + item.start + '–' + item.end + ' · ' + escapeHTML(item.design) + '"></div></div>';
    html += '</div>';
  });
  html += '</div>';
  html += '<div class="bubble-legend">';
  html += '<span class="stacked-legend-item"><span class="waffle-dot" style="background:#0d9488;"></span>Longitudinal/Cohort</span>';
  html += '<span class="stacked-legend-item"><span class="waffle-dot" style="background:#d97706;"></span>Cross-sectional</span>';
  html += '<span class="stacked-legend-item"><span class="waffle-dot" style="background:#6366f1;"></span>Panel</span>';
  html += '<span class="stacked-legend-item"><span class="waffle-dot" style="background:#64748b;"></span>Other</span>';
  html += '</div>';
  container.innerHTML = html;
}

function renderDonut(container, data, size) {
  size = size || 150;
  const total = data.reduce((s, d) => s + d.value, 0);
  const colors = ['#0f172a','#d97706','#0d9488','#e11d48','#6366f1','#059669','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#64748b'];
  let cum = 0;
  const r = size / 2 - 5;
  const cx = size / 2, cy = size / 2;
  const innerR = r * 0.6;

  let paths = '';
  data.forEach((d, i) => {
    const frac = d.value / total;
    const startAngle = cum * 2 * Math.PI - Math.PI / 2;
    cum += frac;
    const endAngle = cum * 2 * Math.PI - Math.PI / 2;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(startAngle), iy1 = cy + innerR * Math.sin(startAngle);
    const ix2 = cx + innerR * Math.cos(endAngle), iy2 = cy + innerR * Math.sin(endAngle);
    paths += `<path d="M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix2},${iy2} A${innerR},${innerR} 0 ${large} 0 ${ix1},${iy1} Z" fill="${colors[i % colors.length]}" />`;
  });

  let legend = '<div class="donut-legend">';
  data.forEach((d, i) => {
    legend += `<div class="legend-item"><span class="legend-dot" style="background:${colors[i % colors.length]}"></span><span class="legend-label">${escapeHTML(truncate(d.label, 25))}</span><span class="legend-val">${d.value.toLocaleString()}</span></div>`;
  });
  legend += '</div>';

  container.innerHTML = `<div class="donut-container">
    <svg class="donut-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${paths}
      <text x="${cx}" y="${cy}" text-anchor="middle" dy=".1em" font-size="22" font-weight="700" fill="#0f172a" font-family="Outfit">${total.toLocaleString()}</text>
      <text x="${cx}" y="${cy}" text-anchor="middle" dy="1.4em" font-size="9" fill="#64748b" font-family="DM Sans">total</text>
    </svg>${legend}</div>`;
}

// ================================================================
// Heatmap matrix
// ================================================================

function renderHeatmap(container, data, datasets, constructs) {
  var maxVal = 0;
  datasets.forEach(function(ds) {
    constructs.forEach(function(cat) {
      var v = (data[ds] && data[ds][cat]) || 0;
      if (v > maxVal) maxVal = v;
    });
  });

  function cellColor(val) {
    if (val === 0) return 'var(--border-light)';
    var t = Math.log(val + 1) / Math.log(maxVal + 1);
    if (t < 0.25) return '#d1fae5';
    if (t < 0.5) return '#6ee7b7';
    if (t < 0.75) return '#059669';
    return '#064e3b';
  }

  function textColor(val) {
    if (val === 0) return 'var(--text-muted)';
    var t = Math.log(val + 1) / Math.log(maxVal + 1);
    return t >= 0.5 ? '#fff' : '#064e3b';
  }

  var html = '<div class="heatmap-scroll"><table class="heatmap-table"><thead><tr><th></th>';
  constructs.forEach(function(cat) {
    html += '<th title="' + escapeHTML(cat) + '">' + escapeHTML(truncate(cat, 20)) + '</th>';
  });
  html += '</tr></thead><tbody>';

  datasets.forEach(function(ds) {
    html += '<tr><td class="heatmap-row-label" title="' + escapeHTML(ds) + '">' + escapeHTML(truncate(ds, 22)) + '</td>';
    constructs.forEach(function(cat) {
      var val = (data[ds] && data[ds][cat]) || 0;
      html += '<td class="heatmap-cell" style="background:' + cellColor(val) + ';color:' + textColor(val) + ';" title="' + escapeHTML(ds) + ' × ' + escapeHTML(cat) + ': ' + val + '">' + (val || '') + '</td>';
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  html += '<div class="heatmap-legend"><span class="heatmap-legend-label">0</span><span class="heatmap-legend-bar"></span><span class="heatmap-legend-label">' + maxVal.toLocaleString() + '</span></div>';
  container.innerHTML = html;
}

// ================================================================
// Accordion
// ================================================================

function initAccordions() {
  document.querySelectorAll('.accordion-header').forEach(h => {
    h.addEventListener('click', () => {
      const item = h.parentElement;
      const wasOpen = item.classList.contains('open');
      item.classList.toggle('open', !wasOpen);
    });
  });
}

// ================================================================
// Init
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
  updateBasketCount();
  initAccordions();
  fetchJSON('data/summary.json').then(s => {
    if (s) document.querySelectorAll('#footer-date').forEach(el => el.textContent = s.last_updated || '');
  });
});
