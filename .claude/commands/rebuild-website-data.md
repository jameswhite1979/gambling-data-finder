---
name: rebuild-website-data
description: Recalculate facets.json and summary.json from the current website data files. Use after any change to variables.json or other data files, or when the user asks to update counts, refresh stats, or rebuild derived data.
---

# Rebuild Website Data

Run the rebuild script directly — do not regenerate the logic:

```
node C:/Users/wppjw/gambling-data-finder/.claude/commands/scripts/rebuild-website-data.js
```

This reads all data files from `website/data/` and rewrites `facets.json` and `summary.json`.

After rebuilding, use `deploy-website` if the user wants to publish.
