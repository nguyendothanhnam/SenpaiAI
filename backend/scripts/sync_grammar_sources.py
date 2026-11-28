"""Fetch pinned public grammar snapshots for redistribution; never runs at app startup.

Run from backend: python -m scripts.sync_grammar_sources
"""
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1] / 'app/data/grammar_sources'
SOURCES = {
    'hanabira': {
        'name': 'Hanabira', 'repository': 'tristcoil/hanabira.org-japanese-content',
        'revision': '1462bb37f0eb229fea58a18eb4855428bdbffa25',
        'url': 'https://hanabira.org', 'license': 'CC BY 4.0',
        'license_url': 'https://creativecommons.org/licenses/by/4.0/',
        'grammar_path': 'grammar_json/grammar_ja_{level}_full_alphabetical_0001.json',
        'notices': {'LICENSE': 'LICENSE', 'README.md': 'README.upstream.md'},
    },
    'openjlpt': {
        'name': 'OpenJLPT v0.2.0', 'repository': 'evanclan/OpenJLPT',
        'revision': 'c42fd9fa3777bfc1775446f7c418d549dfd6e4cf',
        'url': 'https://github.com/evanclan/OpenJLPT/releases/tag/v0.2.0',
        'license': 'CC BY-SA 4.0', 'license_url': 'https://creativecommons.org/licenses/by-sa/4.0/',
        'grammar_path': 'data/json/grammar/{lower}.json',
        'notices': {'LICENSE': 'LICENSE', 'NOTICE.md': 'NOTICE.md'},
    },
}


def main():
    manifest = {'schema_version': 1, 'language': 'en', 'sources': {}}
    for source_id, spec in SOURCES.items():
        directory = ROOT / source_id
        directory.mkdir(parents=True, exist_ok=True)
        files = {}
        requested = [(spec['grammar_path'].format(level=level, lower=level.lower()), f'{level.lower()}.json', level) for level in ['N5', 'N4', 'N3', 'N2', 'N1']]
        requested += [(remote, local, None) for remote, local in spec['notices'].items()]
        for remote, local, level in requested:
            url = f"https://raw.githubusercontent.com/{spec['repository']}/{spec['revision']}/{remote}"
            with urlopen(Request(url, headers={'User-Agent': 'SenpaiAI-grammar-vendor'}), timeout=30) as response:
                raw = response.read(5 * 1024 * 1024 + 1)
            if len(raw) > 5 * 1024 * 1024:
                raise ValueError('Unexpectedly large grammar source')
            count = len(json.loads(raw)) if level else None
            (directory / local).write_bytes(raw)
            files[local] = {'url': url, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw), **({'level': level, 'count': count} if level else {})}
        manifest['sources'][source_id] = {key: value for key, value in spec.items() if key not in {'grammar_path', 'notices'}} | {'files': files}
        print(source_id, {key: value['count'] for key, value in files.items() if 'count' in value}, flush=True)
    ROOT.mkdir(parents=True, exist_ok=True)
    (ROOT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Pinned source snapshots and manifest saved. Commit these files with the importer.')


if __name__ == '__main__':
    main()
