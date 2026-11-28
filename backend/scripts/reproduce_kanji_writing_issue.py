"""Reproduce the v1 scoring coupling, using a frozen copy of its geometry rules.

Only for calibration/auditing; never imported by the application. This synthetic
case is not the original user's trace (the screenshot contains no coordinates).
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.kanji_stroke_geometry import resample, distance, length, evaluate
from app.services.kanji_writing_templates import templates


def v1_normalize(strokes):
    points = [p for s in strokes for p in s]
    x0, y0 = min(p[0] for p in points), min(p[1] for p in points)
    w, h = max(p[0] for p in points)-x0, max(p[1] for p in points)-y0
    scale = max(w,h,1e-9)
    output = []
    for s in strokes:
        smooth = [s[0]]+[tuple((s[i-1][j]+2*s[i][j]+s[i+1][j])/4 for j in (0,1)) for i in range(1,len(s)-1)]+[s[-1]]
        output.append(resample([((x-x0+(scale-w)/2)/scale,(y-y0+(scale-h)/2)/scale) for x,y in smooth]))
    return output


def v1_compare(stroke, template):
    forward = sum(distance(a,b) for a,b in zip(stroke,template))/len(stroke)
    reverse = sum(distance(a,b) for a,b in zip(reversed(stroke),template))/len(stroke)
    endpoints = (distance(stroke[0],template[0])+distance(stroke[-1],template[-1]))/2
    reverse_endpoints = (distance(stroke[-1],template[0])+distance(stroke[0],template[-1]))/2
    ratio = min(length(stroke),length(template))/max(length(stroke),length(template),1e-9)
    return {'distance':min(forward,reverse),'length_ratio':ratio,
            'backward':reverse+.025<forward and reverse_endpoints<endpoints,
            'matches':min(forward,reverse)<=.115 and min(endpoints,reverse_endpoints)<=.19 and ratio>=.48}


def v1_evaluate(strokes, reference):
    user, expected = v1_normalize(strokes), v1_normalize(reference)
    rows, matched = [], set()
    for i, stroke in enumerate(user):
        metrics = v1_compare(stroke,expected[i])
        options = [(j,v1_compare(stroke,other)) for j,other in enumerate(expected) if j not in matched]
        best_index,best = min(options,key=lambda p:p[1]['distance']) if options else (i,metrics)
        if best_index!=i and best['matches'] and best['distance']+.025<metrics['distance']:
            status,actual,metrics = 'wrong_order',best_index,best
        elif metrics['matches']:
            status,actual = ('wrong_direction' if metrics['backward'] else 'correct'),i
        else:
            status,actual = 'wrong_shape',None
        if actual is not None:
            matched.add(actual)
        rows.append({'status':status,'metrics':metrics})
    n = len(reference)
    scores = {'order':round(100*sum(r['status'] in ('correct','wrong_direction') for r in rows)/n),
              'direction':round(100*sum(r['status'] in ('correct','wrong_order') and not r['metrics']['backward'] for r in rows)/n),
              'shape':round(100*sum(max(0,1-r['metrics']['distance']/.23)*min(1,r['metrics']['length_ratio']/.48) for r in rows)/n),
              'completeness':100}
    return {'scores':scores,'overall_score':round(sum(scores.values())/4),'statuses':[r['status'] for r in rows]}


def reproduction():
    raw = templates()['月']['raw']
    strokes = [[(x+(12 if i%2 else -12),y) for x,y in stroke] for i,stroke in enumerate(raw)]
    current = evaluate(strokes,raw)
    return {'kanji':'月','source':'KanjiVG template, alternating per-stroke x offset ±12 SVG units; no stroke reversal or permutation',
            'not_original_user_trace':True,'before':v1_evaluate(strokes,raw),
            'after':{k:current[k] for k in ('scores','overall_score','passed','version','strictness')}}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('--output',type=Path)
    args = parser.parse_args(); result = reproduction()
    if args.output:
        args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=True))
