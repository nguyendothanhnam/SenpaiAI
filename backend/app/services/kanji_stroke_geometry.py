"""Pure geometry; no recognizer, database, framework or per-stroke scaling."""
import math
import re
from ..core import kanji_writing_config as cfg


def distance(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def length(points):
    return sum(distance(a, b) for a, b in zip(points, points[1:]))


def resample(points, count=cfg.SAMPLES):
    points = [tuple(p) for p in points]
    if not points:
        raise ValueError('empty_stroke')
    lengths = [0.0]
    for a, b in zip(points, points[1:]):
        lengths.append(lengths[-1] + distance(a, b))
    if lengths[-1] < 1e-9:
        return [points[0]] * count
    output, index = [], 1
    for i in range(count):
        target = lengths[-1] * i / (count - 1)
        while index < len(points) - 1 and lengths[index] < target:
            index += 1
        ratio = (target - lengths[index - 1]) / max(1e-12, lengths[index] - lengths[index - 1])
        a, b = points[index - 1], points[index]
        output.append((a[0] + ratio * (b[0] - a[0]), a[1] + ratio * (b[1] - a[1])))
    return output


def normalize(strokes):
    """One aspect-preserving transform for ALL strokes; retain their relative layout."""
    if not strokes:
        return []
    # Equal arc-length sampling BEFORE smoothing makes the result independent of
    # pointer-event rate and of the uneven Bezier samples in the template.
    sampled = [resample(s, 64) for s in strokes]
    smoothed = []
    for stroke in sampled:
        smooth = [stroke[0]] + [tuple((stroke[i-1][j] + 2*stroke[i][j] + stroke[i+1][j])/4 for j in (0, 1)) for i in range(1, len(stroke)-1)] + [stroke[-1]]
        smoothed.append(smooth)
    points = [p for stroke in smoothed for p in stroke]
    x0, y0 = min(p[0] for p in points), min(p[1] for p in points)
    w, h = max(p[0] for p in points) - x0, max(p[1] for p in points) - y0
    scale = max(w, h, 1e-9)
    result = []
    for stroke in smoothed:
        result.append(resample([((p[0]-x0+(scale-w)/2)/scale, (p[1]-y0+(scale-h)/2)/scale) for p in stroke]))
    return result


def svg_points(path):
    """KanjiVG M/m C/c S/s (including implicit repeated cubic segments)."""
    tokens = re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?', path)
    i, command, current, control, points = 0, None, (0., 0.), None, []
    while i < len(tokens):
        if tokens[i].isalpha():
            command = tokens[i]; i += 1
        if command not in ('M', 'm', 'C', 'c', 'S', 's'):
            raise ValueError('unsupported_svg_command')
        size = 2 if command.lower() == 'm' else 6 if command.lower() == 'c' else 4
        if i + size > len(tokens) or any(t.isalpha() for t in tokens[i:i+size]):
            raise ValueError('invalid_svg_path')
        values = list(map(float, tokens[i:i+size])); i += size
        pairs = [tuple(values[j:j+2]) for j in range(0, size, 2)]
        if command.islower():
            pairs = [(p[0]+current[0], p[1]+current[1]) for p in pairs]
        if command.lower() == 'm':
            current = pairs[0]; points.append(current); control = None
            continue
        start = current
        if command.lower() == 'c':
            a, b, end = pairs
        else:
            a = (2*current[0]-control[0], 2*current[1]-control[1]) if control else current
            b, end = pairs
        for step in range(1, 25):
            t = step/24; u = 1-t
            points.append(tuple(u**3*start[j]+3*u*u*t*a[j]+3*u*t*t*b[j]+t**3*end[j] for j in (0,1)))
        current, control = end, b
    return points


def compare(stroke, template, thresholds=None):
    thresholds = thresholds or cfg.PROFILES['standard']
    forward = sum(distance(a,b) for a,b in zip(stroke, template))/len(stroke)
    reverse = sum(distance(a,b) for a,b in zip(reversed(stroke), template))/len(stroke)
    endpoints = (distance(stroke[0], template[0])+distance(stroke[-1],template[-1]))/2
    reversed_endpoints = (distance(stroke[-1],template[0])+distance(stroke[0],template[-1]))/2
    ratio = min(length(stroke), length(template))/max(length(stroke),length(template),1e-9)
    u = (stroke[-1][0]-stroke[0][0], stroke[-1][1]-stroke[0][1])
    v = (template[-1][0]-template[0][0], template[-1][1]-template[0][1])
    cosine = (u[0]*v[0]+u[1]*v[1])/max(math.hypot(*u)*math.hypot(*v),1e-12)
    backward = reverse + .006 < forward and reversed_endpoints + .006 < endpoints and cosine < -.25
    return {'distance': min(forward,reverse), 'forward': forward, 'reverse': reverse,
            'endpoints': min(endpoints,reversed_endpoints), 'length_ratio': ratio, 'backward': backward,
            'matches': min(forward,reverse) <= thresholds['distance'] and min(endpoints,reversed_endpoints) <= thresholds['endpoint'] and ratio >= thresholds['length_ratio']}


def assignment(costs):
    """Rectangular Hungarian matching, O(n^3), no ML or scipy dependency."""
    n = len(costs)
    if not n:
        return []
    m = len(costs[0]); u = [0.]*(n+1); v = [0.]*(m+1)
    p = [0]*(m+1); way = [0]*(m+1)
    for i in range(1,n+1):
        p[0] = i; j0 = 0; minimum = [float('inf')]*(m+1); used = [False]*(m+1)
        while True:
            used[j0] = True; i0 = p[j0]; delta = float('inf'); j1 = 0
            for j in range(1,m+1):
                if used[j]:
                    continue
                current = costs[i0-1][j-1]-u[i0]-v[j]
                if current < minimum[j]:
                    minimum[j] = current; way[j] = j0
                if minimum[j] < delta:
                    delta = minimum[j]; j1 = j
            for j in range(m+1):
                if used[j]:
                    u[p[j]] += delta; v[j] -= delta
                else:
                    minimum[j] -= delta
            j0 = j1
            if p[j0] == 0:
                break
        while True:
            j1 = way[j0]; p[j0] = p[j1]; j0 = j1
            if j0 == 0:
                break
    result = [0]*n
    for j in range(1,m+1):
        if p[j]:
            result[p[j]-1] = j-1
    return result


def evaluate(strokes, reference, final=True, strictness='standard'):
    """Prefix normalization is provisional; a final character always uses one full bbox."""
    user = normalize(strokes)
    expected = normalize(reference if final else reference[:max(1,len(strokes))])
    thresholds = cfg.PROFILES[strictness]
    matrix = [[compare(s,t,thresholds) for t in expected] for s in user[:len(expected)]]
    costs = [[m['distance']+.15*m['endpoints']+.025*(1-m['length_ratio']) for m in row] for row in matrix]
    mapping = assignment(costs)
    rows = []
    for i, stroke in enumerate(user):
        if i >= len(expected):
            rows.append({'index':i+1,'status':'extra','expected_index':None,'matched_index':None,'metrics':None}); continue
        metrics = matrix[i][i]
        best_index = mapping[i]; best = matrix[i][best_index]
        order_error = best_index != i and best['matches'] and costs[i][best_index]+thresholds['order_margin'] < costs[i][i]
        actual = best_index if order_error else i
        metrics = best if order_error else metrics
        # A bad shape is NOT evidence of bad order or reversed direction.
        direction_error = metrics['backward'] and metrics['distance'] <= thresholds['distance']*1.5 and metrics['length_ratio'] >= .3
        status = 'wrong_order' if order_error else 'wrong_direction' if direction_error else 'correct' if metrics['matches'] else 'wrong_shape'
        rows.append({'index':i+1,'status':status,'expected_index':i+1,'matched_index':actual+1 if actual is not None else None,
                     'order_error':order_error,'direction_error':direction_error,
                     'metrics':{key:round(val,4) if isinstance(val,float) else val for key,val in metrics.items()}})
    if final:
        for i in range(len(user),len(expected)):
            rows.append({'index':i+1,'status':'missing','expected_index':i+1,'matched_index':None,'metrics':None})
    denominator = max(len(reference),len(user),1)
    present = [r for r in rows if r['metrics']]
    scores = {
        'order':round(100*sum(not r['order_error'] for r in present)/max(1,len(present))),
        'direction':round(100*sum(not r['direction_error'] for r in present)/max(1,len(present))),
        'shape':round(100*sum(max(0,1-max(0,r['metrics']['distance']-.025)/(thresholds['distance']*2)) * min(1,r['metrics']['length_ratio']/thresholds['length_ratio']) for r in present)/denominator),
        'completeness':round(100*max(0,1-abs(len(user)-len(reference))/max(1,len(reference))))}
    overall = round(scores['order']*.2+scores['direction']*.2+scores['shape']*.4+scores['completeness']*.2)
    return {'version':cfg.VERSION,'strictness':strictness,'thresholds':dict(thresholds),'provisional':not final,'strokes':rows,'scores':scores,'overall_score':overall,
            'passed':bool(final and overall>=cfg.PASS_SCORE and len(user)==len(reference) and all(r['status']=='correct' for r in rows)),
            'expected_count':len(reference),'actual_count':len(user)}
