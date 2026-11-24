"""Deterministic synthetic audit, NOT a handwriting accuracy benchmark."""
import argparse
import json
import random
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.services.kanji_writing_templates import templates, comparison_templates, confusion_candidates, evaluate_character
from app.services.kanji_stroke_geometry import evaluate
from app.core.kanji_writing_config import VERSION


def audit():
    bank=templates(); rng=random.Random(20261122)
    groups={}
    def record(group,accepted,expected):
        row=groups.setdefault(group,{'cases':0,'expected_accepted':expected,'correct_decisions':0})
        row['cases']+=1;row['correct_decisions']+=accepted==expected
    for item in bank.values():
        record('exact_template',evaluate(item['raw'],item['raw'])['passed'],True)
    chosen=[]
    for level in ('N5','N4','N3'):
        chosen += sorted(k for k,v in bank.items() if v['level']==level)[:20]
    for key in chosen:
        raw=bank[key]['raw']
        noisy=[[(x+rng.uniform(-.35,.35),y+rng.uniform(-.35,.35)) for x,y in s] for s in raw]
        record('mild_noise',evaluate_character(key,noisy)['passed'],True)
        record('reversed_direction',evaluate_character(key,[list(reversed(raw[0])),*raw[1:]])['passed'],False)
        record('missing_stroke',evaluate_character(key,raw[:-1])['passed'],False)
        record('extra_stroke',evaluate_character(key,raw+[raw[0]])['passed'],False)
        shifted=[[(x+35,y+25) for x,y in raw[0]],*raw[1:]]
        record('displaced_stroke',evaluate_character(key,shifted)['passed'],False)
        if len(raw)>1:
            record('swapped_order',evaluate_character(key,[raw[1],raw[0],*raw[2:]])['passed'],False)
    for target,other in [('未','末'),('土','士'),('大','犬'),('大','太'),('日','目'),('人','入')]:
        result=evaluate_character(target,comparison_templates()[other]['raw'])
        record('manual_confusable',result['passed'],False)
        record('correct_confusion_hint',bool(result['confusion'] and result['confusion']['kanji']==other),True)
    for row in groups.values():
        row['correct_decision_rate']=round(row['correct_decisions']/row['cases'],4)
    positive=[v for k,v in groups.items() if k in ('exact_template','mild_noise')]
    negative=[v for v in groups.values() if not v['expected_accepted']]
    return {'version':VERSION,'seed':20261122,'template_count':len(bank),
        'levels':dict(Counter(v['level'] for v in bank.values())), 'groups':groups,
        'correct_acceptance_rate':sum(v['correct_decisions'] for v in positive)/sum(v['cases'] for v in positive),
        'incorrect_rejection_rate':sum(v['correct_decisions'] for v in negative)/sum(v['cases'] for v in negative),
        'limitations':['Synthetic curves and mild noise only; not real-world handwriting accuracy.',
            'Thresholds need independent teacher-labeled pen/touch samples; no held-out human calibration set.',
            'Near-identical strokes can make geometric order ambiguous; partial feedback is provisional.',
            'Uniform translation/scale are intentionally ignored; no pressure, penmanship or calligraphy grading.']}


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path)
    parser.add_argument('--confusions-output',type=Path)
    args=parser.parse_args()
    report=audit()
    if args.output:args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if args.confusions_output:
        pairs=[{'target':key,'level':item['level'],**pair} for key,item in templates().items() for pair in confusion_candidates(key)]
        args.confusions_output.write_text(json.dumps({'source':'KanjiVG','source_url':'https://kanjivg.tagaini.net/',
            'license':'CC BY-SA 3.0','review_status':'needs_review','pairs':pairs},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True,indent=2))
