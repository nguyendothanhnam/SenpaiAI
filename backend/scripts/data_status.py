"""Read-only health report. Exit 0 ready, 2 partial/missing, 1 diagnostic failure."""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.services.data_health import diagnostic


def check(engine,settings,json_output=False):
    try:result=diagnostic(engine,settings.chroma_persist_directory,settings.listening_media_dir)
    except Exception as exc:
        print(f'Data check failed ({type(exc).__name__}); check DATABASE_URL, schema and source JSON. Credentials are not printed.',file=sys.stderr);return 1
    if json_output:print(json.dumps(result,ensure_ascii=False,indent=2,default=str))
    else:
        print('Database: '+str(result['database']))
        print('Migration current='+str(result['migration']['current'])+' latest='+str(result['migration']['latest']))
        if not result['migration']['ready']:print('  NEED: python scripts/setup_data.py --groups schema')
        for key,value in result['sections'].items():
            print(f"[{key}] {value['status']} "+json.dumps(value,ensure_ascii=False,default=str))
        print('READY' if result['ready'] else 'PARTIAL / còn thiếu: follow the commands above. Placement demo/absent banks are never certified as a real test.')
    return 0 if result['ready'] else 2


def main(argv=None):
    if hasattr(sys.stdout,'reconfigure'):sys.stdout.reconfigure(encoding='utf8',errors='replace')
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--json',action='store_true');args=parser.parse_args(argv)
    from app.core.config import settings
    from app.core.database import engine
    return check(engine,settings,args.json)


if __name__=='__main__':raise SystemExit(main())
