---
name: add-variables
description: Add new variable records to the Gambling Data Finder website. Use when the user asks to add variables, extract variables from a data dictionary, or expand the variable catalogue. Handles deduplication, facet rebuild, and summary recalculation.
---

# Add Variables

## Step 1: Extract variables (judgement step)

Read the source data dictionary using the search script:

```bash
# Standard Excel file:
node C:/Users/wppjw/gambling-data-finder/.claude/commands/scripts/search-dictionary.js "<path-to-excel>"

# ALSPAC layout (col0=file, col1=varname, col2=label):
node C:/Users/wppjw/gambling-data-finder/.claude/commands/scripts/search-dictionary.js "<path>" --alspac --sheet "<sheet>"

# MCS layout (headers contain \r\n):
node C:/Users/wppjw/gambling-data-finder/.claude/commands/scripts/search-dictionary.js "<path>" --mcs

# List available sheets:
node C:/Users/wppjw/gambling-data-finder/.claude/commands/scripts/search-dictionary.js "<path>" --list-sheets
```

Data dictionaries are in: `C:\Users\wppjw\OneDrive - Cardiff University\Bids\UKRI\GHRIPPs\Study\Data availability\Dataset metadata dictionary questionnaire\`

Use judgement to filter relevant variables and assign categories.

## Step 2: Format records

Write a JSON array to a temp file. Each record must have:

```json
{
  "variable_row_id": "V_{DATASET_ID}_{TYPE}_{NNN}",
  "dataset_id": "", "dataset_name": "", "wave_year": "", "age_group": "",
  "construct_category": "", "variable_name": "", "variable_label": "",
  "named_measure": "", "role": "Gambling measure | Risk/protective factor | Metadata | Other variable",
  "risk_domain": "", "timing": "", "variable_url": "", "questionnaire_url": "",
  "metadata_status": "", "meta_analysis_note": "", "include_website": "Yes"
}
```

Optional: `question_text` (full questionnaire wording, makes it searchable).

Row ID types: `GM` (gambling measure), `RF` (risk factor), `META` (metadata), `OV` (other).

## Step 3: Merge and rebuild (fixed script)

```bash
node C:/Users/wppjw/gambling-data-finder/.claude/commands/scripts/merge-variables.js /tmp/new-records.json
```

Deduplicates by `variable_row_id` and `dataset_id|variable_name`, then rebuilds facets.json and summary.json.

## Step 4: Check explore.html topic tree

If new construct categories or risk domains were added, update the `TOPIC_FOLDERS` constant in `explore.html`.

## Step 5: Deploy

Use the `deploy-website` command to push changes.
