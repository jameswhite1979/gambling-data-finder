# Gambling Data Finder

UKRI GHRIPPs project website for researchers to discover and compare gambling-related datasets across studies.

**Live site:** https://jameswhite1979.github.io/gambling-data-finder/

## Architecture

Static HTML/CSS/JS site with JSON data files in `data/`. No backend. Deployed via GitHub Pages.

- **Pages:** index.html, search.html, explore.html, study.html, measures.html, publications.html, new-analysis.html, about.html
- **Shared code:** app.js, style.css
- **Data files (in `data/`):** variables.json, datasets.json, publications.json, questionnaires.json, gambling_measures.json, sources.json, facets.json (derived), summary.json (derived)

## Inclusion criterion

**To be included, a study must collect data on gambling participation or gambling harm.**

That is the whole test for a record in `datasets.json`. Everything else the catalogue holds -
risk/protective factors, participant characteristics, questionnaires, access routes - is
supporting detail attached to a study that already passes it.

**Risk and protective factors are not part of the test, in either direction.** They do not
qualify a study on their own, and their absence does not disqualify one. A study measuring
gambling participation with no risk factors recorded at all is in; a study with a rich
risk-factor battery and no gambling measure is out.

Read the criterion strictly:

- **Participation** means the data identify who gambled: an item on gambling behaviour,
  frequency, product type, or expenditure. An item on gambling *winnings received* is not
  participation. It cannot separate a non-gambler from a gambler who lost, so it fails.
- **Harm** means a screen (PGSI, SOGS, DSM-IV-MR-J, CPGI, PPGM, NODS), a consequence item, or a
  recorded clinical diagnosis such as ICD-10 F63.0 or Z72.6.

A study may pass on either one alone. UK Biobank has no participation item and is included
solely on its linked clinical diagnosis codes.

Contextual and administrative datasets that measure the gambling environment rather than people
(for example AHAH, which holds gambling outlet density) are a deliberate exception. Add one only
when it supports analysis of the studies that do meet the criterion, and say so in the record.

**Do not create a dataset record to document a negative screening result.** A record asserts the
study belongs in the catalogue. When a study is checked and found to carry no qualifying measure,
record it in the RA brief's closed list instead, with the sources checked and the date. Two
studies, BHPS and ELSA, were added this way in error and removed on 2026-08-20.

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
