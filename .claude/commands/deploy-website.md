---
name: deploy-website
description: Copy updated website files from OneDrive to the gambling-data-finder git repo and push to GitHub Pages. Use when the user says push, deploy, publish, or update the website.
---

# Deploy Website

## Step 1: Copy and check

The git repo is the source of truth. The OneDrive working copy is older than the repo for
every site and data file, so the script copies a file only when the OneDrive copy is newer
than the repo copy and prints what it skipped.

```bash
bash .claude/commands/scripts/deploy-website.sh
```

Review the git diff output to confirm only expected files changed.

## Step 1b: Rebuild derived output

The header, footer and study-card markup live only in app.js and are baked into every page
between `<!-- build_static:... -->` markers by `scripts/build_static.js`; the sitemap comes
from `scripts/build_seo.py`. After any data change, and after editing the nav, footer or
study cards in app.js:

```bash
py scripts/validate_and_update.py <DATASET_ID> --data-dir data
node scripts/build_static.js
py scripts/build_seo.py            # only if a dataset or page was added or removed
node scripts/build_static.js --check
```

CI fails if the static blocks are stale, so commit the regenerated `.html` files with the data.

## Step 2: Commit and push

Stage only the changed files, write a descriptive commit message (no AI attribution), and push:

```bash
git add <files> && git commit -m "<message>" && git push
```
