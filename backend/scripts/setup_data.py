"""One entry point: migrate, load real sources, optionally index/synthesize, inspect."""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.services.data_health import inventory
from app.services.data_setup import ORDER,Skipped,plan,run_step,script


def main(argv=None):
    if hasattr(sys.stdout,'reconfigure'):sys.stdout.reconfigure(encoding='utf8',errors='replace')
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--groups',default=','.join(ORDER),help='Comma-separated groups; dependencies are added automatically')
    parser.add_argument('--check-only',action='store_true',help='Read-only health check: no migration, seed, file write or network')
    parser.add_argument('--inventory',action='store_true',help='List scripts, safety, service dependencies and migration chain')
    parser.add_argument('--download',action='store_true',help='Download only pinned real OpenJLPT when local source is missing; no model download')
    parser.add_argument('--external',action='store_true',help='Allow existing Ollama embedding/VOICEVOX services; never install models')
    parser.add_argument('--json',action='store_true',help='JSON diagnostics for --check-only')
    parser.add_argument('--report',type=Path)
    args=parser.parse_args(argv)
    if args.inventory:print(json.dumps(inventory(),ensure_ascii=False,indent=2));return 0
    from app.core.config import settings
    from app.core.database import engine
    if args.check_only:
        return script('data_status').check(engine,settings,json_output=args.json)
    try:selected=plan([s.strip() for s in args.groups.split(',') if s.strip()])
    except ValueError as exc:parser.error(str(exc))
    print('Thứ tự / plan: '+' -> '.join(selected))
    print('Database: '+str(engine.url.database)+' (credentials hidden)')
    results=[]
    for name in selected:
        print(f'[{name}] RUN',flush=True)
        try:
            value=run_step(name,engine,settings,args);results.append({'step':name,'status':'done','result':value})
            print(f'[{name}] DONE '+json.dumps(value,ensure_ascii=False,default=str))
        except Skipped as exc:
            results.append({'step':name,'status':'skipped','reason':str(exc)});print(f'[{name}] SKIP: {exc}')
        except Exception as exc:
            # Do not dump SQL connection URLs or secret-bearing request/config objects.
            print(f'[{name}] FAILED ({type(exc).__name__}). Stopped. Check source/schema/service for this step; earlier steps may be committed and are safe to rerun.',file=sys.stderr)
            if isinstance(exc,(ValueError,FileNotFoundError)):print(str(exc)[:300],file=sys.stderr)
            return 1
    if args.report:
        args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(results,ensure_ascii=False,indent=2,default=str),encoding='utf8')
    print('Setup complete with '+str(sum(r['status']=='skipped' for r in results))+' explicitly skipped steps. Run python scripts/data_status.py; SKIP does not mean all features are ready.')
    if any(r['step']=='index' and r['status']=='done' for r in results):print('Restart the backend to reload its in-memory search index. Keep the backend stopped while rebuilding the index.')
    return 0


if __name__=='__main__':raise SystemExit(main())
