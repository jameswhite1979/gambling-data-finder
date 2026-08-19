---
name: deploy-website
description: Copy updated website files from OneDrive to the gambling-data-finder git repo and push to GitHub Pages. Use when the user says push, deploy, publish, or update the website.
---

# Deploy Website

## Step 1: Copy and check

```bash
bash .claude/commands/scripts/deploy-website.sh
```

Review the git diff output to confirm only expected files changed.

## Step 2: Commit and push

Stage only the changed files, write a descriptive commit message (no AI attribution), and push:

```bash
git add <files> && git commit -m "<message>" && git push
```
