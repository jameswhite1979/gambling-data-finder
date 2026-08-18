# Gambling Data Finder

UKRI GHRIPPs project website for researchers to discover and compare gambling-related datasets across studies.

**Live site:** https://jameswhite1979.github.io/gambling-data-finder/

## Architecture

Static HTML/CSS/JS site with JSON data files in `data/`. No backend. Deployed via GitHub Pages.

- **Pages:** index.html, search.html, explore.html, study.html, measures.html, publications.html, new-analysis.html, about.html
- **Shared code:** app.js, style.css
- **Data files (in `data/`):** variables.json, datasets.json, publications.json, questionnaires.json, gambling_measures.json, sources.json, facets.json (derived), summary.json (derived)

## Data model

Each variable record in `variables.json` has these fields:

```
variable_row_id, dataset_id, dataset_name, wave_year, age_group,
construct_category, variable_name, variable_label, named_measure,
role, risk_domain, timing, variable_url, questionnaire_url,
metadata_status, meta_analysis_note, include_website
```

Optional: `question_text` (full questionnaire wording — makes it searchable).

- **Roles:** `Gambling measure`, `Risk/protective factor`, `Metadata`, `Other variable`
- **Row ID format:** `V_{DATASET_ID}_{TYPE}_{NNN}` where TYPE = GM, RF, META, OV
- **Dataset ID convention:** UPPERCASE_WITH_UNDERSCORES, e.g. `ALSPAC`, `HSE2021`, `BIB_AOW`

## Derived files

`facets.json` and `summary.json` are derived from the other data files. **After editing any data file**, rebuild them:

```
python scripts/validate_and_update.py <DATASET_ID> --data-dir data
```

This validates all 9 JSON files, checks cross-references, fixes facets.json, and recounts summary.json.

It also fills gaps in `metadata_check.json`: any dataset without an entry gets a derived stub, so
the coverage table never renders blank rows after an ingest. **Existing entries are never
modified** - that file holds hand-written prose (CLOSER result, next extraction action) which
cannot be recomputed, so curated text is safe. A warning is raised for entries whose dataset no
longer exists.

Summary field sources:
- `datasets` = length of datasets.json
- `gambling_measures` = length of gambling_measures.json
- `gambling_variables` = count of role == "Gambling measure" in variables.json
- `risk_protective_variables` = count of role == "Risk/protective factor" in variables.json
- `questionnaires` = length of questionnaires.json
- `publications` = length of publications.json
- `source_urls` = length of sources.json

## Editing data files

Edit the JSON files in `data/` directly. Key rules:

1. **Always validate JSON** after editing — a parse error will break the entire site
2. **Use straight quotes** (`"`) never smart/curly quotes
3. **Run the validation script** after any data change
4. **Do not reformat or re-sort** existing entries for other datasets
5. **Do not remove entries** unless explicitly asked
6. **Access difficulty** values must be one of: `Open`, `Registration / safeguarded`, `Controlled`

## ID conventions

| File | ID field | Format | Example |
|------|----------|--------|---------|
| datasets.json | `Dataset_ID` | `{DATASET_ID}` | `FINLAND_SHP` |
| sources.json | `Source_ID` | `SRC_{DATASET_ID}_{NNN}` | `SRC_FINLAND_SHP_001` |
| publications.json | `Publication_ID` | `PUB_{DATASET_ID}_{NNN}` | `PUB_FINLAND_SHP_001` |
| questionnaires.json | `Questionnaire_ID` | `Q_{DATASET_ID}_{NN}` | `Q_FINLAND_SHP_01` |
| variables.json | `variable_row_id` | `V_{DATASET_ID}_{NNN}` | `V_FINLAND_SHP_001` |

## Gambling measure normalisation

Normalise gambling measure names to these canonical forms:
- **PGSI** (includes CPGI, CPGI/PGSI)
- **DSM-IV-MR-J** (adolescent screen)
- **DSM-IV-PG** (adult diagnostic)
- **SOGS-RA** (South Oaks revised adolescent)
- **CAGI** (Canadian Adolescent Gambling Inventory)

## explore.html topic tree

The browse-by-topic tree is defined in the `TOPIC_FOLDERS` JavaScript constant in `explore.html`. If you add new `construct_category` or `risk_domain` values, check whether they need adding to this tree.

## Constraints

- Never credit AI tools (Codex, Claude, GPT, etc.) as author or contributor in commits, pages, or metadata
- Do not add comments to JSON files
- Keep commits focused — one logical change per commit
