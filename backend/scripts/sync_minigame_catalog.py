"""Package the existing shared word catalog for backend-only deployments."""
import json,hashlib,argparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    raw=(ROOT.parent/'shared-games/catalog.json').read_bytes()
    data={'source':'SenpaiAI shared-games/catalog.json','sha256':hashlib.sha256(raw).hexdigest(),'words':json.loads(raw)['words']}
    output=ROOT/'app/data/minigame_words.json'
    if args.check:
        if json.loads(output.read_text(encoding='utf-8'))!=data:raise SystemExit('Minigame catalog is stale')
    else:output.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f"Canonical game words: {len(data['words'])}")
