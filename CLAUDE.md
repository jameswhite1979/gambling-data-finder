# Gambling Data Finder

UKRI GHRIPPs project website for researchers to discover and compare gambling-related datasets across studies.

**Live site:** https://www.gamblingdatafinder.com/ (custom domain set via `CNAME`; the old
`jameswhite1979.github.io/gambling-data-finder/` address now 301-redirects here). The site is
served from the domain root, so absolute paths are `/style.css`, not `/gambling-data-finder/style.css`.

## Paths

Absolute paths are machine-specific and this repo is public, so they are not recorded here.
They live in `.claude/commands/scripts/local-paths.json`, which is gitignored. On a new
machine, copy `local-paths.example.json` to `local-paths.json` and fill in `oneDriveRoot`,
or set the `GDF_ONEDRIVE_ROOT` environment variable.

- **Git repo (deploy here):** the repo root - scripts derive it from their own location
- **Working copy:** `<oneDriveRoot>/website/`
- **Data dictionaries:** `<oneDriveRoot>/Dataset metadata dictionary questionnaire/`
- **Paper & build scripts:** `<oneDriveRoot>/Paper/`

## Architecture

Static HTML/CSS/JS site with JSON data files. No backend. Deployed via GitHub Pages.

- **Pages:** index.html, search.html, explore.html, studies.html, study.html, compare.html, measures.html, new-analysis.html, analysis-ideas.html, visualisations.html, coverage.html, special-datasets.html, howto.html, faq.html, about.html, basket.html, 404.html
- **Shared code:** app.js, style.css
- **Data files (in `data/`):** variables.json, datasets.json, publications.json, questionnaires.json, gambling_measures.json, sources.json, facets.json (derived), summary.json (derived), study_stats.json (derived)

## Data model

Each variable record in `variables.json` has: `variable_row_id`, `dataset_id`, `dataset_name`, `wave_year`, `age_group`, `construct_category`, `variable_name`, `variable_label`, `named_measure`, `role`, `risk_domain`, `timing`, `variable_url`, `questionnaire_url`, `metadata_status`, `meta_analysis_note`, `include_website`. Optional: `question_text`.

- **Roles:** Gambling measure, Risk/protective factor, Metadata, Other variable
- **Row ID format:** `V_{DATASET_ID}_{TYPE}_{NNN}` where TYPE = GM, RF, META, OV

## Derived files

`facets.json`, `summary.json` and `study_stats.json` are derived from the other data files. After editing any data file, rebuild them:

```
py scripts/validate_and_update.py <DATASET_ID> --data-dir data
```

This validates all JSON files, checks cross-references, fixes facets.json, recounts summary.json, and regenerates study_stats.json (per-study counts + named measures — study.html, studies.html and compare.html read this instead of the big files).

A GitHub Action (`.github/workflows/validate.yml`) runs the same validation on every push and fails if JSON is broken, mojibake bytes are present, or derived files are stale — always run the script locally and commit its output before pushing data changes.

### Static header, footer and study-card grids

The shared header, footer and the study-card grids on index.html and studies.html are derived output too. Their markup lives only in app.js (`renderNav`, `renderFooter`, `renderStudyGrid`); `scripts/build_static.js` runs those functions in Node with `data/datasets.json`, `data/study_stats.json` and `data/summary.json` (footer date) and writes the result into every `*.html` between `<!-- build_static:... -->` marker comments, so the raw HTML carries the navigation and dataset links. Re-run it after the validation script, after editing the nav, footer or card functions in app.js, and after adding a page:

```
node scripts/build_static.js
```

`node scripts/build_static.js --check` reports stale pages without writing anything; CI runs it and fails if any page is stale. Never hand-edit the content between the markers. Each page calls `mountChrome('<id>')`, which renders the chrome client-side only when the static block is missing, so a page still works if the build is skipped.

## Conventions

- `access.json` is the source of truth for access information; the access fields duplicated in `datasets.json` (Access type/difficulty/request URL) must be kept in sync with it.
- `variables.json` and `gambling_measures.json` are stored **minified** (single line). Edit them via scripts, never by hand.
- `style.css` and `app.js` are included with a version query (`?v=N`). Bump N in **all** HTML pages whenever either file changes (GitHub Pages caches for 10 minutes); `build_static.js --check` fails if pages disagree on N. Four pages (index, studies, study, analysis-ideas) are CRLF in the working tree and GNU `sed -i` strips their CRs, so bump with `sed -b -i` or a Node script.
- Fonts are loaded via `<link>` tags in each page head — do not re-add an `@import` to style.css.
- Every page head carries a canonical link plus `og:`/`twitter:` tags pointing at
  `https://www.gamblingdatafinder.com/`. New pages need the same block, and must be added to
  the sitemap by re-running `scripts/build_seo.py`. Pages marked `<meta name="robots" content="noindex">`
  (404, basket) are excluded from the sitemap automatically. `study.html` is deliberately the one
  page with **no** static canonical — `setStudyMeta()` in that file writes a per-study one at
  runtime, because a static canonical would collapse every `?id=` URL into a single page.
- Read dataset IDs from records via `getDatasetId()` in app.js (files use `dataset_id`, `Dataset_ID` and `Dataset ID` inconsistently).
- A new page needs an empty `<div id="header"></div>` and `<div id="footer"></div>` (or an empty `<!-- build_static:header -->` / `<!-- /build_static:header -->` pair where the block should sit, as in basket.html), `id="main-content"` on its main wrapper (the skip-link target), exactly one `mountChrome('<id>')` call in its script (never `renderNav()` directly), a `<title>` of the form `Page name | Gambling Data Finder`, and a run of `node scripts/build_static.js`.

## Skills and scripts

| Task | How |
|------|-----|
| Add a new dataset | `/ghripps-add-dataset` — full workflow with validation |
| Rebuild facets + summary | `python scripts/validate_and_update.py <DATASET_ID> --data-dir data` |
| Rebuild static header/footer/study grids | `node scripts/build_static.js` (after validate_and_update.py, after nav/footer/card changes in app.js, after adding a page; `--check` to verify) |
| Rebuild sitemap + robots | `py scripts/build_seo.py` (run after adding/removing a dataset or a page) |
| Merge new variables into existing dataset | Write new records to a temp JSON file, then `node .claude/commands/scripts/merge-variables.js <file>` |
| Read a data dictionary | `node .claude/commands/scripts/search-dictionary.js <xlsx> [--alspac\|--mcs] [--sheet name] [--list-sheets]` |
| Deploy to GitHub Pages | `bash .claude/commands/scripts/deploy-website.sh` then `git add`, `git commit`, `git push` |

## Deploy workflow

1. Edit data files in the git repo (`data/*.json`) or OneDrive working copy
2. If edited in OneDrive, run the deploy script to copy files to the git repo
3. Rebuild derived files if data changed: `py scripts/validate_and_update.py <ID> --data-dir data`, then `node scripts/build_static.js` (also after any change to the nav, footer or study cards in app.js), then `py scripts/build_seo.py` if a dataset or page was added or removed
4. `git add <files> && git commit -m "<message>" && git push` — a `last_updated` change touches the footer of all 17 pages, so stage the regenerated `.html` files too
5. GitHub Pages rebuilds in ~1 minute

## Important notes

- The v21 mapping workbook in OneDrive is STALE — do not re-run a full export from it. Edit the deployed JSON directly.
- `gh` CLI is not installed. Use `git` commands for pushing. Git Credential Manager handles auth.
- XLSX module is installed in the OneDrive `Data availability/node_modules/` directory. The search-dictionary script resolves it from there automatically.
