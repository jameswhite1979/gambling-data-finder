const fs = require('fs');
const path = require('path');
const BASE_DIR = path.join('C:', 'Users', 'wppjw', 'OneDrive - Cardiff University',
  'Bids', 'UKRI', 'GHRIPPs', 'Study', 'Data availability');
const XLSX = require(path.join(BASE_DIR, 'node_modules', 'xlsx'));

// Usage: node search-dictionary.js <excel-file> [sheet-name] [--alspac] [--mcs]
// Reads an Excel data dictionary and prints all rows as JSON for filtering.
// Flags:
//   --alspac  Use ALSPAC column layout (col0=file, col1=varname, col2=label)
//   --mcs     Use MCS column layout (headers contain \r\n, regex key matching)
//   --sheet <name>  Specify sheet name (default: first sheet)
//   --list-sheets   Just list available sheet names

const args = process.argv.slice(2);
const filePath = args.find(a => !a.startsWith('--'));
if (!filePath) {
  console.error('Usage: node search-dictionary.js <excel-file> [--sheet name] [--alspac|--mcs] [--list-sheets]');
  process.exit(1);
}

const isAlspac = args.includes('--alspac');
const isMcs = args.includes('--mcs');
const listSheets = args.includes('--list-sheets');
const sheetIdx = args.indexOf('--sheet');
const sheetName = sheetIdx >= 0 ? args[sheetIdx + 1] : null;

const wb = XLSX.readFile(filePath);

if (listSheets) {
  console.log(JSON.stringify(wb.SheetNames));
  process.exit(0);
}

const ws = sheetName ? wb.Sheets[sheetName] : wb.Sheets[wb.SheetNames[0]];
if (!ws) {
  console.error('Sheet not found. Available:', wb.SheetNames.join(', '));
  process.exit(1);
}

let rows;

if (isAlspac) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
  rows = raw
    .filter(r => r[1] && String(r[1]).trim())
    .map(r => ({
      file_id: String(r[0] || '').trim(),
      variable_name: String(r[1] || '').trim(),
      variable_label: String(r[2] || '').trim(),
    }));
} else if (isMcs) {
  const raw = XLSX.utils.sheet_to_json(ws);
  const keys = raw.length ? Object.keys(raw[0]) : [];
  const findKey = (pattern) => keys.find(k => pattern.test(k.replace(/\r?\n/g, ' '))) || '';
  const varNameKey = findKey(/variable\s+name/i);
  const varLabelKey = findKey(/variable\s+label/i);
  const sweepKey = findKey(/sweep|year|age/i);
  const topicKey = findKey(/^topic$/i);
  const subTopicKey = findKey(/sub\s*topic/i);
  const questionKey = findKey(/question\s+text/i);

  rows = raw.map(r => ({
    variable_name: String(r[varNameKey] || '').trim(),
    variable_label: String(r[varLabelKey] || '').trim(),
    sweep: String(r[sweepKey] || '').trim(),
    topic: String(r[topicKey] || '').trim(),
    sub_topic: String(r[subTopicKey] || '').trim(),
    question_text: String(r[questionKey] || '').trim(),
  }));
} else {
  rows = XLSX.utils.sheet_to_json(ws).map(r => {
    const out = {};
    for (const [k, v] of Object.entries(r)) {
      out[k.replace(/\r?\n/g, ' ').trim()] = String(v || '').trim();
    }
    return out;
  });
}

console.log(JSON.stringify(rows));
