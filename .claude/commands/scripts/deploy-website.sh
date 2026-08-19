#!/bin/bash
# Copy website files from OneDrive working directory to git repo
# Usage: bash deploy-website.sh [commit message]

# Paths are resolved at run time so none are hard-coded into this public repo.
# DST comes from this script's own location; SRC from local-paths.json (gitignored).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DST="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SRC="$(cd "$SCRIPT_DIR" && node -p "require('./paths.js').siteDir()")"

if [ ! -d "$SRC" ]; then
  echo "Source directory not found: $SRC" >&2
  echo "Check .claude/commands/scripts/local-paths.json" >&2
  exit 1
fi

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
