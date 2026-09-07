#!/bin/bash
# Copy website files from the OneDrive working directory to the git repo.
# Usage: bash deploy-website.sh
#
# The git repo is the source of truth. A file is copied only when the OneDrive
# copy is newer than the repo copy, so a stale working copy can never overwrite
# newer work in the repo (including the static header, footer and study-card
# blocks that scripts/build_static.js writes into the pages). Skipped files are
# reported.

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

# Copy $1 (relative to both roots) only when the OneDrive copy is newer.
copy_if_newer() {
  local rel="$1"
  if [ -f "$SRC/$rel" ]; then
    if [ "$SRC/$rel" -nt "$DST/$rel" ]; then
      cp "$SRC/$rel" "$DST/$rel"
      echo "copied  $rel"
    else
      echo "skipped $rel (OneDrive copy is not newer than the repo copy)"
    fi
  fi
}

# Data files
for f in variables.json facets.json summary.json datasets.json publications.json questionnaires.json sources.json gambling_measures.json access.json metadata_check.json; do
  copy_if_newer "data/$f"
done

# HTML/CSS/JS
for f in index.html search.html explore.html study.html measures.html new-analysis.html about.html app.js style.css; do
  copy_if_newer "$f"
done

cd "$DST"
echo "=== Git status ==="
git status
echo ""
echo "=== Diff stats ==="
git diff --stat
echo ""
echo "Next: py scripts/validate_and_update.py <ID> --data-dir data ; node scripts/build_static.js ; py scripts/build_seo.py (if a dataset or page was added or removed)"
echo "      then node scripts/build_static.js --check before committing"
