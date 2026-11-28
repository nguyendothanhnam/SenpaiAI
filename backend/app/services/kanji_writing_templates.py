"""Local KanjiVG adapters and candidate confusions (candidates require teacher review)."""
import json
from functools import lru_cache
from pathlib import Path
from ..core import kanji_writing_config as cfg
from .kanji_dictionary_service import kanji_dictionary_service
from .kanjivg_service import svg_path_for_kanji, parse_kanjivg_svg
from .kanji_stroke_geometry import svg_points, normalize, compare, distance

MANUAL_GROUPS = ('未末', '土士', '大犬太', '日目', '人入')
RULES = ('top_bottom', 'left_right', 'horizontal_vertical', 'outside_inside', 'close_last', 'exceptions')


@lru_cache(maxsize=1)
def templates():
    data = {}
    root = Path(__file__).resolve().parents[1]/'data'
    for filename in ('kanjivg_strokes.json','kanjivg_strokes_n3.json'):
        data.update(json.loads((root/filename).read_text(encoding='utf-8')))
    entries, _ = kanji_dictionary_service.list_entries(limit=10000)
    result = {}
    for entry in entries:
        key = entry['kanji']
        if entry.get('jlpt') not in ('N5','N4','N3'):
            continue
        try:
            item = data.get(key)
            if item is None and svg_path_for_kanji(key).is_file():
                item = parse_kanjivg_svg(svg_path_for_kanji(key), {'kanji':key})
            if item is None:
                continue
            raw = [svg_points(stroke['path']) for stroke in item['strokes']]
            if raw and all(len(s)>1 for s in raw):
                result[key] = {'kanji':key,'level':entry['jlpt'],'raw':raw,'normalized':normalize(raw)}
        except ValueError:
            continue  # Fail closed: unsupported paths never become exercises.
    return result


def character_distance(a,b):
    # Order-independent distance is ONLY for confusion hints, never grading order.
    if not a or not b:
        return 1.
    forward = sum(min(compare(s,t)['distance'] for t in b) for s in a)/len(a)
    backward = sum(min(compare(t,s)['distance'] for s in a) for t in b)/len(b)
    return (forward+backward)/2 + abs(len(a)-len(b))*.025


@lru_cache(maxsize=1)
def comparison_templates():
    """Manual contrasts may be outside the taught N5–N3 dictionary (e.g. 士)."""
    bank = dict(templates())
    for key in set(''.join(MANUAL_GROUPS)) - bank.keys():
        path = svg_path_for_kanji(key)
        if path.is_file():
            raw = [svg_points(s['path']) for s in parse_kanjivg_svg(path,{'kanji':key})['strokes']]
            bank[key] = {'kanji':key,'level':None,'raw':raw,'normalized':normalize(raw)}
    return bank


@lru_cache(maxsize=1024)
def confusion_candidates(kanji):
    bank = comparison_templates(); current = bank[kanji]['normalized']
    manual = {c for group in MANUAL_GROUPS if kanji in group for c in group if c!=kanji}
    automatic = []
    for other,item in bank.items():
        if other==kanji or abs(len(current)-len(item['normalized']))>1:
            continue
        # Cheap ordered signature before the more expensive matching step.
        signature = sum(sum(distance(p,q) for p,q in zip(a[::8],b[::8]))/4 for a,b in zip(current,item['normalized']))/max(len(current),len(item['normalized']))
        if signature < cfg.CONFUSION_DISTANCE:
            automatic.append((signature,other))
    candidates = manual | {key for _,key in sorted(automatic)[:8]}
    result = []
    for other in sorted(candidates):
        if other not in bank:
            continue
        alternate = bank[other]['normalized']
        differences = []
        for index in range(max(len(current),len(alternate))):
            if index>=len(current) or index>=len(alternate):
                differences.append({'target_stroke':index+1 if index<len(current) else None,'other_stroke':index+1 if index<len(alternate) else None,'reason':'count'})
                continue
            metrics = compare(current[index],alternate[index])
            if metrics['distance']>.025 or metrics['length_ratio']<.85:
                differences.append({'target_stroke':index+1,'other_stroke':index+1,
                                    'reason':'length' if metrics['length_ratio']<.85 else 'position_shape'})
        result.append({'kanji':other,'origin':'manual' if other in manual else 'automatic',
                       'review_status':'needs_review','distinguishing_strokes':differences,
                       'distance':round(character_distance(current,alternate),4)})
    return sorted(result,key=lambda row:(row['origin']!='manual',row['distance']))


def confusion_hint(kanji, strokes, evaluation):
    if not strokes:
        return None
    current = normalize(strokes)
    baseline = character_distance(current,templates()[kanji]['normalized'])
    options = []
    for pair in confusion_candidates(kanji):
        distinguishing = pair['distinguishing_strokes']
        alternative = comparison_templates()[pair['kanji']]['normalized']
        if len(alternative)!=len(strokes):
            continue
        value = character_distance(current,alternative)
        # Require a close whole-character alternative AND concrete evidence at
        # a distinguishing stroke. Merely winning a nearest-neighbour race is weak.
        affected = []
        target = templates()[kanji]['normalized']
        for difference in distinguishing:
            index = difference['target_stroke']
            if difference['reason'] == 'count' or index and index <= len(current) and (
                compare(current[index-1], target[index-1])['distance'] > .035 or
                compare(current[index-1], target[index-1])['length_ratio'] < .85):
                affected.append(difference)
        if affected and value<cfg.CONFUSION_HINT_MAX and value+cfg.CONFUSION_HINT_MARGIN<baseline:
            pair = {**pair, 'distinguishing_strokes':affected}
            options.append((value,pair))
    if not options:
        return None
    options.sort(key=lambda p:p[0])
    if len(options)>1 and options[1][0]-options[0][0]<cfg.CONFUSION_MARGIN:
        return None
    _,pair = options[0]
    return {**pair,'message_key':'writing.confusion'}


def evaluate_character(kanji, strokes, final=True, strictness='standard'):
    """Confusion is advisory; only the target's geometry determines the score."""
    from .kanji_stroke_geometry import evaluate
    result = evaluate(strokes,templates()[kanji]['raw'],final,strictness)
    hint = confusion_hint(kanji,strokes,result) if final else None
    result['confusion']=hint
    return result


def template_response(kanji):
    item = templates()[kanji]
    return {'kanji':kanji,'level':item['level'],'strokes':[[{'x':x,'y':y} for x,y in stroke] for stroke in item['normalized']],
            'stroke_count':len(item['raw']),'rules':[{'key':f'writing.rules.{rule}'} for rule in RULES],
            'confusions':confusion_candidates(kanji),'version':cfg.VERSION,
            'source':'KanjiVG','source_url':'https://kanjivg.tagaini.net/','license':'CC BY-SA 3.0'}
