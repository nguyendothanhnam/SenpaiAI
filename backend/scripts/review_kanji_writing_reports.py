"""Bounded LOCAL review export; reports are unverified, never training labels."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.database import SessionLocal
from app.models.database import KanjiWritingReport


def export_reports(db, user_id=None, limit=100, offset=0):
    query = db.query(KanjiWritingReport)
    if user_id is not None:
        query = query.filter_by(user_id=user_id)
    rows = query.order_by(KanjiWritingReport.id.desc()).offset(offset).limit(limit).all()
    return {'manual_review_required':True, 'limit':limit, 'offset':offset, 'items':[
        {'report_id':r.report_key,'kanji':r.kanji,'strokes':r.strokes,'result':r.result,
         'comment':r.comment,'created_at':r.created_at.isoformat(),'review_status':'pending'} for r in rows]}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--user-id', type=int)
    parser.add_argument('--limit', type=int, default=100)
    parser.add_argument('--offset', type=int, default=0)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not 1 <= args.limit <= 500 or args.offset < 0:
        parser.error('limit 1..500; offset >= 0')
    with SessionLocal() as db:
        result = export_reports(db,args.user_id,args.limit,args.offset)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f"Exported {len(result['items'])} unverified reports. No data changed.")
