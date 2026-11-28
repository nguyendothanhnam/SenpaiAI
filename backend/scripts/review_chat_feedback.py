"""Export answer feedback for LOCAL review; never auto-add unverified reports to gold."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.core.database import SessionLocal
from app.models.database import ChatAnswerFeedback,ChatHistory


def export_feedback(db,rating='incorrect',limit=100,offset=0,include_identifiers=False):
    query=db.query(ChatAnswerFeedback,ChatHistory).join(ChatHistory,ChatHistory.id==ChatAnswerFeedback.chat_history_id)
    if rating!='all':query=query.filter(ChatAnswerFeedback.rating==rating)
    rows=query.order_by(ChatAnswerFeedback.updated_at.desc(),ChatAnswerFeedback.id.desc()).offset(offset).limit(limit).all()
    return {'rating':rating,'limit':limit,'offset':offset,'manual_review_required':True,'items':[
        {'feedback_id':feedback.id,'rating':feedback.rating,'comment':feedback.comment,'question':answer.question,'answer':answer.answer,
         'sources':answer.sources,'updated_at':feedback.updated_at.isoformat(),'review_status':'pending',
         **({'user_id':feedback.user_id,'conversation_id':str(feedback.conversation_id),'message_id':answer.id} if include_identifiers else {})}
        for feedback,answer in rows]}


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--rating',choices=('incorrect','helpful','all'),default='incorrect')
    parser.add_argument('--limit',type=int,default=100)
    parser.add_argument('--offset',type=int,default=0)
    parser.add_argument('--include-identifiers',action='store_true')
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if not 1<=args.limit<=500 or args.offset<0:parser.error('limit 1..500; offset >= 0')
    with SessionLocal() as db:
        report=export_feedback(db,args.rating,args.limit,args.offset,args.include_identifiers)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f"Exported {len(report['items'])} feedback rows for manual review; nothing added to the evaluation dataset.")
