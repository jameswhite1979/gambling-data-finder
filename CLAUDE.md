# Gambling Data Finder

UKRI GHRIPPs project website for researchers to discover and compare gambling-related datasets across studies.

**Live site:** https://jameswhite1979.github.io/gambling-data-finder/

## Paths

- **Git repo (deploy here):** `C:\Users\wppjw\gambling-data-finder\`
- **Working copy:** `C:\Users\wppjw\OneDrive - Cardiff University\Bids\UKRI\GHRIPPs\Study\Data availability\website\`
- **Data dictionaries:** `C:\Users\wppjw\OneDrive - Cardiff University\Bids\UKRI\GHRIPPs\Study\Data availability\Dataset metadata dictionary questionnaire\`
- **Paper & build scripts:** `C:\Users\wppjw\OneDrive - Cardiff University\Bids\UKRI\GHRIPPs\Study\Data availability\Paper\`

## Architecture

Static HTML/CSS/JS site with JSON data files. No backend. Deployed via GitHub Pages.

- **Pages:** index.html, search.html, explore.html, study.html, measures.html, publications.html, new-analysis.html, about.html
- **Shared code:** app.js, style.css
- **Data files (in `data/`):** variables.json, datasets.json, publications.json, questionnaires.json, gambling_measures.json, sources.json, facets.json (derived), summary.json (derived)

## Data model

Each variable record in `variables.json` has: `variable_row_id`, `dataset_id`, `dataset_name`, `wave_year`, `age_group`, `construct_category`, `variable_name`, `variable_label`, `named_measure`, `role`, `risk_domain`, `timing`, `variable_url`, `questionnaire_url`, `metadata_status`, `meta_analysis_note`, `include_website`. Optional: `question_text`.

- **Roles:** Gambling measure, Risk/protective factor, Metadata, Other variable
- **Row ID format:** `V_{DATASET_ID}_{TYPE}_{NNN}` where TYPE = GM, RF, META, OV

## Derived files

`facets.json` and `summary.json` are derived from the other data files. After editing any data file, rebuild them:

```
node .claude/commands/scripts/rebuild-website-data.js
```

Summary fields: `datasets` = datasets.json length, `gambling_measures` = gambling_measures.json length, `gambling_variables` / `risk_protective_variables` = role counts from variables.json, `questionnaires` / `publications` / `source_urls` = respective file lengths.

## Reusable scripts

Run these directly — do not regenerate the logic:

| Task | Command |
|------|---------|
| Rebuild facets + summary | `node .claude/commands/scripts/rebuild-website-data.js` |
| Merge new variables | Write new records to a temp JSON file, then `node .claude/commands/scripts/merge-variables.js <file>` |
| Read a data dictionary | `node .claude/commands/scripts/search-dictionary.js <xlsx> [--alspac\|--mcs] [--sheet name] [--list-sheets]` |
| Deploy to GitHub Pages | `bash .claude/commands/scripts/deploy-website.sh` then `git add`, `git commit`, `git push` |

## Deploy workflow

1. Edit data files in the git repo (`data/*.json`) or OneDrive working copy
2. If edited in OneDrive, run the deploy script to copy files to the git repo
3. Rebuild derived files if data changed
4. `git add <files> && git commit -m "<message>" && git push`
5. GitHub Pages rebuilds in ~1 minute

## Important notes

- The v21 mapping workbook in OneDrive is STALE — do not re-run a full export from it. Edit the deployed JSON directly.
- `gh` CLI is not installed. Use `git` commands for pushing. Git Credential Manager handles auth.
- XLSX module is installed in the OneDrive `Data availability/node_modules/` directory. The search-dictionary script resolves it from there automatically.
- Never credit Claude/AI in commits, pages, or document metadata.
