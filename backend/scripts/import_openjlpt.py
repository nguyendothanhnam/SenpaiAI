"""Download pinned OpenJLPT JSON inside this repo; preview or explicitly merge it."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.services.openjlpt_import import LEVELS, import_entries
from app.core.database import SessionLocal
from sqlalchemy import inspect

PIN = '0d1d3410bec90bd4098a7c72de820543cb4f707c'
DEFAULT_DIRECTORY = ROOT / 'downloads/openjlpt' / PIN


def download(directory, revision=PIN):
    directory = directory.resolve()
    if not directory.is_relative_to(ROOT.parent.resolve()):
        raise ValueError('Downloads must stay inside the project.')
    if not re.fullmatch('[0-9a-f]{40}', revision):
        raise ValueError('Use a full pinned commit SHA, not a moving branch.')
    directory.mkdir(parents=True, exist_ok=True)
    files = ['data/json/meta.json', 'schema/vocab.schema.json', 'NOTICE.md', 'LICENSE', 'README.md']
    files += [f'data/json/vocab/{level.lower()}.json' for level in LEVELS]
    manifest = {'repository': 'https://github.com/evanclan/OpenJLPT', 'commit': revision, 'files': {}}
    for name in files:
        url = f'https://raw.githubusercontent.com/evanclan/OpenJLPT/{revision}/{name}'
        request = urllib.request.Request(url, headers={'User-Agent': 'SenpaiAI-OpenJLPT-import'})
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read(16 * 1024 * 1024 + 1)
        if len(raw) > 16 * 1024 * 1024:
            raise ValueError('Unexpectedly large vocabulary file')
        target = directory / name
        target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(raw)
        manifest['files'][name] = {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'url': url}
    manifest['downloaded_bytes'] = sum(row['bytes'] for row in manifest['files'].values())
    (directory / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')
    return manifest


def load_dataset(directory):
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf8'))
    for name, item in manifest['files'].items():
        path = (directory / name).resolve()
        if not path.is_relative_to(directory.resolve()) or hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
            raise ValueError('Source checksum/path mismatch: ' + name)
    meta = json.loads((directory / 'data/json/meta.json').read_text(encoding='utf8'))
    rows = []
    for level in LEVELS:
        items = json.loads((directory / f'data/json/vocab/{level.lower()}.json').read_text(encoding='utf8'))
        if not isinstance(items, list):
            raise ValueError('Vocabulary JSON must be an array: ' + level)
        rows.extend(items)
    return rows, meta, manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=DEFAULT_DIRECTORY)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--download-only', action='store_true')
    parser.add_argument('--revision', default=PIN)
    parser.add_argument('--write', action='store_true', help='Without this flag the database is not changed.')
    parser.add_argument('--batch-size', type=int, default=500)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    if args.download_only and not args.download:
        parser.error('--download-only requires --download')
    if args.download:
        manifest = download(args.source_dir, args.revision)
        print('Downloaded bytes:', manifest['downloaded_bytes'])
    if args.download_only:
        return
    rows, meta, manifest = load_dataset(args.source_dir)
    with SessionLocal() as db:
        columns = {c['name'] for c in inspect(db.get_bind()).get_columns('vocabulary')}
        if not {'meaning_en', 'meaning_vi_status', 'source_id', 'search_text'} <= columns:
            raise SystemExit('Apply Alembic migration 0029 (OpenJLPT) before importing; no rows were written.')
        report = import_entries(db, rows, f"{meta['version']}@{manifest['commit']}", dry_run=not args.write,
                                batch_size=args.batch_size, upstream=meta.get('sources', {}))
        if args.write:
            db.commit()
    report['source_manifest'] = manifest
    print(json.dumps({k: v for k, v in report.items() if k != 'source_manifest'}, ensure_ascii=True, indent=2))
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')


if __name__ == '__main__':
    main()
