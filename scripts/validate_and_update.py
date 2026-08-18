"""
GHRIPPs post-edit validation and summary/facets update.

Usage:
    python scripts/validate_and_update.py DATASET_ID [--data-dir PATH]

Checks:
  - All 9 JSON files parse
  - Dataset_ID present in datasets.json, access.json, facets.json
  - Source/pub/questionnaire/variable/gambling_measure entries reference correct ID
  - No duplicate IDs within any file
  - summary.json counts match actual array lengths

Fixes:
  - Adds Dataset_ID to facets.json datasets array if missing
  - Recounts and rewrites summary.json from actual data
  - Sets summary.json last_updated to today
  - Regenerates study_stats.json (per-study counts + named measures)
"""

import json, sys, os, re
from datetime import date
from collections import Counter

DEFAULT_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

def load(data_dir, name):
    path = os.path.join(data_dir, name)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def save(data_dir, name, data, indent=1):
    path = os.path.join(data_dir, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=indent, ensure_ascii=False)

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/validate_and_update.py DATASET_ID [--data-dir PATH]")
        sys.exit(1)

    dataset_id = sys.argv[1]
    data_dir = DEFAULT_DATA_DIR
    if "--data-dir" in sys.argv:
        idx = sys.argv.index("--data-dir")
        data_dir = sys.argv[idx + 1]

    errors = []
    warnings = []

    files = {
        "datasets.json": None,
        "access.json": None,
        "sources.json": None,
        "publications.json": None,
        "questionnaires.json": None,
        "gambling_measures.json": None,
        "variables.json": None,
        "facets.json": None,
        "summary.json": None,
    }

    for name in files:
        try:
            files[name] = load(data_dir, name)
        except Exception as e:
            errors.append(f"PARSE FAIL: {name} — {e}")

    if any(v is None for v in files.values()):
        for e in errors:
            print(f"  FAIL  {e}")
        sys.exit(1)

    datasets = files["datasets.json"]
    access = files["access.json"]
    sources = files["sources.json"]
    publications = files["publications.json"]
    questionnaires = files["questionnaires.json"]
    gambling_measures = files["gambling_measures.json"]
    variables = files["variables.json"]
    facets = files["facets.json"]
    summary = files["summary.json"]

    print(f"Validating {dataset_id}...\n")

    ds_ids = {d["Dataset_ID"] for d in datasets}
    if dataset_id not in ds_ids:
        errors.append(f"datasets.json: {dataset_id} not found")
    else:
        print(f"  OK    datasets.json")

    acc_ids = {a["Dataset_ID"] for a in access}
    if dataset_id not in acc_ids:
        errors.append(f"access.json: {dataset_id} not found")
    else:
        print(f"  OK    access.json")

    if dataset_id not in facets["datasets"]:
        if dataset_id in ds_ids:
            facets["datasets"].append(dataset_id)
            save(data_dir, "facets.json", facets)
            print(f"  FIXED facets.json — added {dataset_id}")
        else:
            errors.append(f"facets.json: {dataset_id} not in datasets array")
    else:
        print(f"  OK    facets.json")

    src_ds = {s.get("Dataset_ID", s.get("dataset_id", "")) for s in sources}
    if dataset_id not in src_ds:
        warnings.append(f"sources.json: no entries for {dataset_id}")
    else:
        n = sum(1 for s in sources if s.get("Dataset_ID", s.get("dataset_id", "")) == dataset_id)
        print(f"  OK    sources.json ({n} entries)")

    pub_ds = {p.get("Dataset ID", p.get("Dataset_ID", "")) for p in publications}
    if dataset_id not in pub_ds:
        warnings.append(f"publications.json: no entries for {dataset_id}")
    else:
        n = sum(1 for p in publications if p.get("Dataset ID", p.get("Dataset_ID", "")) == dataset_id)
        print(f"  OK    publications.json ({n} entries)")

    q_ds = {q.get("Dataset_ID", q.get("dataset_id", "")) for q in questionnaires}
    if dataset_id not in q_ds:
        warnings.append(f"questionnaires.json: no entries for {dataset_id}")
    else:
        n = sum(1 for q in questionnaires if q.get("Dataset_ID", q.get("dataset_id", "")) == dataset_id)
        print(f"  OK    questionnaires.json ({n} entries)")

    gm_ds = {g.get("Dataset_ID", g.get("dataset_id", "")) for g in gambling_measures}
    if dataset_id not in gm_ds:
        warnings.append(f"gambling_measures.json: no entries for {dataset_id}")
    else:
        n = sum(1 for g in gambling_measures if g.get("Dataset_ID", g.get("dataset_id", "")) == dataset_id)
        print(f"  OK    gambling_measures.json ({n} entries)")

    var_ds = {v.get("dataset_id", v.get("Dataset_ID", "")) for v in variables}
    if dataset_id not in var_ds:
        warnings.append(f"variables.json: no entries for {dataset_id}")
    else:
        n = sum(1 for v in variables if v.get("dataset_id", v.get("Dataset_ID", "")) == dataset_id)
        print(f"  OK    variables.json ({n} entries)")

    def check_dupes(data, id_field, filename):
        ids = [d.get(id_field, "") for d in data if d.get(id_field)]
        dupes = [k for k, v in Counter(ids).items() if v > 1]
        if dupes:
            errors.append(f"{filename}: duplicate {id_field} values: {dupes}")
        return len(dupes) == 0

    check_dupes(datasets, "Dataset_ID", "datasets.json")
    check_dupes(sources, "Source_ID", "sources.json")
    check_dupes(questionnaires, "Questionnaire_ID", "questionnaires.json")
    vid_field = "variable_row_id" if variables and "variable_row_id" in variables[0] else "Variable_Row_ID"
    check_dupes(variables, vid_field, "variables.json")

    pub_id_field = "Publication_ID" if publications and "Publication_ID" in publications[0] else None
    if pub_id_field:
        check_dupes(publications, pub_id_field, "publications.json")

    role_counts = Counter(v.get("role", "") for v in variables)
    new_summary = {
        "studies": len(datasets),
        "datasets": sum(d.get("Number of datasets", 1) for d in datasets),
        "variables": len(variables),
        "questionnaires": len(questionnaires),
        "gambling_measures": len(gambling_measures),
        "gambling_variables": role_counts.get("Gambling measure", 0),
        "risk_protective_variables": role_counts.get("Risk/protective factor", 0),
        "source_urls": len(sources),
        "last_updated": date.today().isoformat(),
        "publications": len(publications),
    }

    # last_updated only moves when a real count changes, so re-running the
    # script on unchanged data is a no-op (keeps CI staleness checks honest)
    changed = {k: (summary.get(k), new_summary[k]) for k in new_summary
               if k != "last_updated" and summary.get(k) != new_summary[k]}
    if not changed:
        new_summary["last_updated"] = summary.get("last_updated", new_summary["last_updated"])
    if changed:
        save(data_dir, "summary.json", new_summary, indent=1)
        print(f"\n  FIXED summary.json:")
        for k, (old, new) in changed.items():
            print(f"        {k}: {old} -> {new}")
    else:
        print(f"\n  OK    summary.json (counts correct)")

    # ---- study_stats.json: per-study counts + named measures ----
    # Lets study.html / compare.html show counts and measure chips without
    # fetching the multi-megabyte variables.json / gambling_measures.json.
    stats = {}
    for d in datasets:
        ds_id = d.get("Dataset_ID")
        if not ds_id:
            continue
        ds_vars = [v for v in variables if v.get("dataset_id") == ds_id]
        ds_measures = [m for m in gambling_measures if m.get("Dataset_ID") == ds_id]
        named = []
        for m in ds_measures:
            nm = (m.get("Named measure") or "").strip()
            if not nm or nm.lower() == "none":
                continue
            for part in re.split(r"\s*[;,]\s*", nm):
                if part and part.lower() != "none" and part not in named:
                    named.append(part)
        stats[ds_id] = {
            "variables": len(ds_vars),
            "gambling": sum(1 for v in ds_vars if v.get("role") == "Gambling measure"),
            "risk": sum(1 for v in ds_vars if v.get("role") == "Risk/protective factor"),
            "questionnaires": sum(1 for q in questionnaires if q.get("Dataset_ID") == ds_id),
            "sources": sum(1 for s in sources if s.get("Dataset_ID") == ds_id),
            "measures": len(ds_measures),
            "named_measures": named,
        }
    try:
        old_stats = load(data_dir, "study_stats.json")
    except Exception:
        old_stats = None
    if stats != old_stats:
        save(data_dir, "study_stats.json", stats, indent=1)
        print(f"  FIXED study_stats.json ({len(stats)} studies)")
    else:
        print(f"  OK    study_stats.json")

    # ---- facets.named_measures: regenerate from variables so it can't go stale ----
    all_named = sorted({(v.get("named_measure") or "").strip() for v in variables
                        if (v.get("named_measure") or "").strip()
                        and (v.get("named_measure") or "").strip().lower() != "none"})
    if facets.get("named_measures") != all_named:
        facets["named_measures"] = all_named
        save(data_dir, "facets.json", facets, indent=1)
        print(f"  FIXED facets.json named_measures ({len(all_named)} measures)")
    else:
        print(f"  OK    facets.json named_measures")

    # ---- measure_stats.json: per named gambling measure summary for measures.html ----
    measure_stats = []
    gamb_named = sorted({(v.get("named_measure") or "").strip() for v in variables
                         if v.get("role") == "Gambling measure" and (v.get("named_measure") or "").strip()
                         and (v.get("named_measure") or "").strip().lower() != "none"})
    for name in gamb_named:
        mvars = [v for v in variables if v.get("role") == "Gambling measure"
                 and (v.get("named_measure") or "").strip() == name]
        note = ""
        for m in gambling_measures:
            if (m.get("Named measure") or "").strip() == name and m.get("Meta-analysis compatibility note"):
                note = m["Meta-analysis compatibility note"]
                break
        measure_stats.append({
            "name": name,
            "variables": len(mvars),
            "datasets": sorted({v.get("dataset_id") for v in mvars if v.get("dataset_id")}),
            "constructs": sorted({v.get("construct_category") for v in mvars if v.get("construct_category")}),
            "note": note,
        })
    try:
        old_ms = load(data_dir, "measure_stats.json")
    except Exception:
        old_ms = None
    if measure_stats != old_ms:
        save(data_dir, "measure_stats.json", measure_stats, indent=1)
        print(f"  FIXED measure_stats.json ({len(measure_stats)} measures)")
    else:
        print(f"  OK    measure_stats.json")

    # ---- metadata_check.json: fill gaps only ----
    # Unlike the other derived files this one holds hand-written prose (CLOSER
    # result, next extraction action) that cannot be recomputed, so existing
    # entries are never touched. New datasets get a derived stub instead, which
    # is what stops the coverage table rendering blanks after an ingest.
    UK = {"united kingdom", "england", "scotland", "wales", "northern ireland", "great britain"}
    try:
        meta_check = load(data_dir, "metadata_check.json")
    except Exception:
        meta_check = None
    if isinstance(meta_check, list):
        have = {m.get("Dataset_ID") for m in meta_check}
        added = []
        for d in datasets:
            ds_id = d.get("Dataset_ID")
            if not ds_id or ds_id in have:
                continue
            n_vars = sum(1 for v in variables if v.get("dataset_id") == ds_id)
            n_quest = sum(1 for q in questionnaires if q.get("Dataset_ID") == ds_id)
            route = (d.get("Codebook / variable URL(s)") or d.get("Metadata / data profile URL")
                     or d.get("Dataset/home URL") or "")
            country = (d.get("Country") or "").strip().lower()
            meta_check.append({
                "Dataset_ID": ds_id,
                "Dataset name": d.get("Dataset name", ds_id),
                "Public catalogue/tool checked": "Yes" if route else "",
                "CLOSER result": "Not a CLOSER source" if country in UK else "Not applicable",
                "Study-specific public metadata route": route,
                "Variable names public?": "Yes" if n_vars else "No",
                "Question wording public?": "Yes" if n_quest else "",
                "Raw data access status": "%s (%s)" % (d.get("Access type") or "Not stated",
                                                       d.get("Access difficulty") or "not stated"),
                "Metadata access needed?": "No" if n_vars else "Yes",
                "Next extraction action": "" if n_vars else "Obtain variable-level documentation",
                "Source URLs": route,
            })
            added.append(ds_id)
        orphans = sorted(have - {d.get("Dataset_ID") for d in datasets} - {None})
        if added:
            save(data_dir, "metadata_check.json", meta_check, indent=1)
            print(f"  FIXED metadata_check.json (+{len(added)}: {', '.join(added)})")
        else:
            print(f"  OK    metadata_check.json")
        if orphans:
            warnings.append(f"metadata_check.json: entries for datasets no longer in datasets.json: {orphans}")

    print()
    if errors:
        print(f"ERRORS ({len(errors)}):")
        for e in errors:
            print(f"  FAIL  {e}")
    if warnings:
        print(f"WARNINGS ({len(warnings)}):")
        for w in warnings:
            print(f"  WARN  {w}")
    if not errors and not warnings:
        print("ALL CHECKS PASSED")

    sys.exit(1 if errors else 0)

if __name__ == "__main__":
    main()
