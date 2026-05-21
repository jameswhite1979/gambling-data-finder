#!/bin/bash
# Copy website files from OneDrive working directory to git repo
# Usage: bash deploy-website.sh [commit message]

SRC="C:/Users/wppjw/OneDrive - Cardiff University/Bids/UKRI/GHRIPPs/Study/Data availability/website"
DST="C:/Users/wppjw/gambling-data-finder"

# Data files (always sync)
for f in variables.json facets.json summary.json datasets.json publications.json questionnaires.json sources.json gambling_measures.json access.json metadata_check.json; do
  if [ -f "$SRC/data/$f" ]; then
    cp "$SRC/data/$f" "$DST/data/$f"
  fi
done

# HTML/CSS/JS (sync if source is newer)
for f in index.html search.html explore.html study.html measures.html publications.html new-analysis.html about.html app.js style.css; do
  if [ -f "$SRC/$f" ]; then
    cp "$SRC/$f" "$DST/$f"
  fi
done

cd "$DST"
echo "=== Git status ==="
git status
echo ""
echo "=== Diff stats ==="
git diff --stat
