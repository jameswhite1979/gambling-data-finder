"""Generate sitemap.xml and robots.txt for the Gambling Data Finder.

Study pages are driven by data/datasets.json rather than listed by hand, so the
sitemap cannot drift out of step with the catalogue. Re-run after adding or
removing a dataset:

    py scripts/build_seo.py

Pages carrying <meta name="robots" content="noindex"> are skipped automatically.
"""
import argparse
import json
import os
import re
import subprocess
import sys

SITE = 'https://www.gamblingdatafinder.com/'

# study.html is the shared shell behind every ?id= URL and has no content of its
# own; the 31 study URLs built from datasets.json stand in for it.
SHELL_PAGES = {'study.html'}

NOINDEX_RE = re.compile(r'<meta\s+name="robots"\s+content="[^"]*noindex', re.I)


def git_date(repo, path, fallback):
    """Date of the last commit touching path, for <lastmod>.

    File mtimes are useless here — a fresh clone stamps everything with the
    checkout time. Falls back to the catalogue date outside a git tree.
    """
    try:
        out = subprocess.run(
            ['git', 'log', '-1', '--format=%cs', '--', path],
            cwd=repo, capture_output=True, text=True, timeout=15)
        return out.stdout.strip() or fallback
    except (OSError, subprocess.SubprocessError):
        return fallback


def collect_pages(repo):
    """Root-level HTML pages that should be indexed, as (loc_path, filename)."""
    pages = []
    for fname in sorted(f for f in os.listdir(repo) if f.endswith('.html')):
        if fname in SHELL_PAGES:
            continue
        with open(os.path.join(repo, fname), encoding='utf-8') as fh:
            if NOINDEX_RE.search(fh.read()):
                continue
        pages.append(('' if fname == 'index.html' else fname, fname))
    return pages


def build_sitemap(repo):
    with open(os.path.join(repo, 'data', 'datasets.json'), encoding='utf-8') as fh:
        datasets = json.load(fh)
    with open(os.path.join(repo, 'data', 'summary.json'), encoding='utf-8') as fh:
        data_date = json.load(fh)['last_updated']

    entries = [(SITE + loc, git_date(repo, fname, data_date))
               for loc, fname in collect_pages(repo)]

    # Study pages change whenever the catalogue does, not when study.html does.
    for ds in datasets:
        entries.append((SITE + 'study.html?id=' + ds['Dataset_ID'], data_date))

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, lastmod in entries:
        lines += ['  <url>',
                  '    <loc>%s</loc>' % loc.replace('&', '&amp;'),
                  '    <lastmod>%s</lastmod>' % lastmod,
                  '  </url>']
    lines.append('</urlset>')
    return '\n'.join(lines) + '\n', len(entries)


def build_robots():
    return ('User-agent: *\n'
            'Allow: /\n'
            '\n'
            'Sitemap: %ssitemap.xml\n' % SITE)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--repo', default=os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))))
    ap.add_argument('--check', action='store_true',
                    help='exit 1 if the files on disk are stale, write nothing')
    args = ap.parse_args()

    sitemap, count = build_sitemap(args.repo)
    robots = build_robots()

    stale = False
    for name, text in (('sitemap.xml', sitemap), ('robots.txt', robots)):
        path = os.path.join(args.repo, name)
        current = None
        if os.path.exists(path):
            with open(path, encoding='utf-8') as fh:
                current = fh.read()
        if current == text:
            print('%-12s unchanged' % name)
            continue
        if args.check:
            print('%-12s STALE' % name)
            stale = True
            continue
        with open(path, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(text)
        print('%-12s written' % name)

    print('sitemap URLs: %d' % count)
    if stale:
        print('\nRun: py scripts/build_seo.py')
        sys.exit(1)


if __name__ == '__main__':
    main()
