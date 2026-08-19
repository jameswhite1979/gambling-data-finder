---
name: add-variables
description: Add new variable records to the Gambling Data Finder website. Use when the user asks to add variables, extract variables from a data dictionary, or expand the variable catalogue. Handles deduplication, facet rebuild, and summary recalculation.
---

# Add Variables

## Step 1: Extract variables (judgement step)

Read the source data dictionary using the search script:

```bash
# Standard Excel file:
node .claude/commands/scripts/search-dictionary.js "<path-to-excel>"

# ALSPAC layout (col0=file, col1=varname, col2=label):
node .claude/commands/scripts/search-dictionary.js "<path>" --alspac --sheet "<sheet>"

# MCS layout (headers contain \r\n):
node .claude/commands/scripts/search-dictionary.js "<path>" --mcs

# List available sheets:
node .claude/commands/scripts/search-dictionary.js "<path>" --list-sheets
```

Data dictionaries live in the `Dataset metadata dictionary questionnaire` folder inside the
OneDrive working directory. That path is machine-specific, so it is kept in
`.claude/commands/scripts/local-paths.json` (gitignored) rather than hard-coded here.

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

## Step 3: Merge (fixed script)

```bash
node .claude/commands/scripts/merge-variables.js /tmp/new-records.json
```

Deduplicates by `variable_row_id` and `dataset_id|variable_name`.

## Step 4: Validate and rebuild derived files

```bash
python scripts/validate_and_update.py <DATASET_ID> --data-dir data
```

This validates all JSON files, fixes facets.json, and recounts summary.json.

## Step 5: Check explore.html topic tree

If new construct categories or risk domains were added, update the `TOPIC_FOLDERS` constant in `explore.html`.

## Step 5: Deploy

Use the `deploy-website` command to push changes.
