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
    backward = reverse + cfg.DIRECTION_REVERSE_MARGIN < forward and reversed_endpoints + cfg.DIRECTION_REVERSE_MARGIN < endpoints and cosine < cfg.DIRECTION_COSINE_LIMIT
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


def ordered_alignment(costs, expected_count):
    """Minimum-cost monotonic correspondence with exactly the observed count gap.

    Skip only the longer side, so malformed shapes remain shape errors rather
    than being silently discarded as an arbitrary number of extra/missing lines.
    """
    n, m = len(costs), expected_count
    values = [[float('inf')] * (m + 1) for _ in range(n + 1)]
    steps = {}
    values[0][0] = 0.
    for i in range(n + 1):
        for j in range(m + 1):
            if i and j:
                values[i][j] = values[i-1][j-1] + costs[i-1][j-1]
                steps[i, j] = 'match'
            if n < m and j and values[i][j-1] < values[i][j]:
                values[i][j] = values[i][j-1]; steps[i, j] = 'missing'
            if n > m and i and values[i-1][j] < values[i][j]:
                values[i][j] = values[i-1][j]; steps[i, j] = 'extra'
    result, i, j = {}, n, m
    while i or j:
        step = steps[i, j]
        if step == 'match':
            result[i-1] = j-1; i -= 1; j -= 1
        elif step == 'missing':
            j -= 1
        else:
            i -= 1
    return result


def gap_alignment(matrix, costs, expected_count, thresholds):
    """Prefer an ordered gap hypothesis; allow reordering only on strong evidence."""
    ordered = ordered_alignment(costs, expected_count)
    padded = [row + [0.] * max(0, len(costs)-expected_count) for row in costs]
    free = {i: j for i, j in enumerate(assignment(padded)) if j < expected_count}
    proof = cfg.GAP_ORDER_PROOF
    def identified(i):
        j = free[i]
        value = matrix[i][j]
        return (i in ordered and value['matches']
            and value['distance'] <= thresholds['distance'] * proof['distance_ratio']
            and value['endpoints'] <= thresholds['endpoint'] * proof['endpoint_ratio']
            and value['length_ratio'] >= proof['length_ratio']
            and costs[i][j] + thresholds['order_margin'] * proof['margin_multiplier'] < costs[i][ordered[i]])
    errors = set()
    pairs = sorted(free.items())
    for position, (i, target) in enumerate(pairs):
        for other, other_target in pairs[position+1:]:
            if target > other_target and identified(i) and identified(other):
                errors.update((i, other))
    return (free, errors) if errors else (ordered, set())


def evaluate(strokes, reference, final=True, strictness='standard'):
    """Prefix normalization is provisional; a final character always uses one full bbox."""
    user = normalize(strokes)
    expected = normalize(reference if final else reference[:max(1,len(strokes))])
    thresholds = cfg.PROFILES[strictness]
    matrix = [[compare(s,t,thresholds) for t in expected] for s in user]
    costs = [[m['distance']+cfg.MATCH_ENDPOINT_WEIGHT*m['endpoints']+cfg.MATCH_LENGTH_WEIGHT*(1-m['length_ratio']) for m in row] for row in matrix]
    has_gap = final and len(user) != len(expected)
    if has_gap:
        aligned, gap_order_errors = gap_alignment(matrix, costs, len(expected), thresholds)
        order_positions = dict(zip(sorted(aligned), sorted(aligned.values())))
    else:
        mapping = assignment(costs[:len(expected)])
        aligned = {i: i for i in range(min(len(user), len(expected)))}
    rows = []
    for i, stroke in enumerate(user):
        if i not in aligned:
            rows.append({'index':i+1,'status':'extra','expected_index':None,'matched_index':None,'metrics':None}); continue
        if has_gap:
            actual = aligned[i]
            order_error = i in gap_order_errors
            expected_index = order_positions[i] if order_error else actual
            metrics = matrix[i][actual]
        else:
            metrics = matrix[i][i]
            best_index = mapping[i]; best = matrix[i][best_index]
            order_error = best_index != i and best['matches'] and costs[i][best_index]+thresholds['order_margin'] < costs[i][i]
            actual = best_index if order_error else i
            expected_index = i
            metrics = best if order_error else metrics
        # A bad shape is NOT evidence of bad order or reversed direction.
        evidence = metrics['distance'] <= thresholds['distance']*cfg.DIRECTION_EVIDENCE_DISTANCE_FACTOR and metrics['length_ratio'] >= cfg.DIRECTION_EVIDENCE_LENGTH_RATIO
        direction_error = metrics['backward'] and evidence
        status = 'wrong_order' if order_error else 'wrong_direction' if direction_error else 'correct' if metrics['matches'] else 'wrong_shape'
        rows.append({'index':i+1,'status':status,'expected_index':expected_index+1,'matched_index':actual+1 if actual is not None else None,
                     'order_error':order_error,'direction_error':direction_error,
                     'order_assessed':bool(evidence or order_error), 'direction_assessed':bool(evidence),
                     'metrics':{key:round(val,4) if isinstance(val,float) else val for key,val in metrics.items()}})
    if final:
        missing = sorted(set(range(len(expected))) - set(aligned.values()))
        for offset, target in enumerate(missing, start=1):
            # Keep row IDs unique and outside actual user traces. expected_index
            # identifies the template gap, including gaps at the start or middle.
            rows.append({'index':len(user)+offset,'status':'missing','expected_index':target+1,'matched_index':None,'metrics':None})
    denominator = max(len(reference),len(user),1)
    present = [r for r in rows if r['metrics']]
    shape_total = 0.0
    for row in rows:
        if not row['metrics']:
            row['criterion_scores'] = {'order': None, 'direction': None, 'shape': 0 if row['status'] == 'missing' else None}
            continue
        metrics = row['metrics']
        shape = max(0,1-max(0,metrics['distance']-cfg.SHAPE_DISTANCE_TOLERANCE)/(thresholds['distance']*cfg.SHAPE_DISTANCE_MULTIPLIER)) * min(1,metrics['length_ratio']/thresholds['length_ratio'])
        shape_total += 100*shape
        row['criterion_scores'] = {'order': (0 if row['order_error'] else 100) if row['order_assessed'] else None,
                                   'direction': (0 if row['direction_error'] else 100) if row['direction_assessed'] else None,
                                   'shape': round(100*shape)}
    order_rows = [r for r in present if r['order_assessed']]
    direction_rows = [r for r in present if r['direction_assessed']]
    scores = {
        'order':round(100*sum(not r['order_error'] for r in order_rows)/max(1,len(order_rows))),
        'direction':round(100*sum(not r['direction_error'] for r in direction_rows)/max(1,len(direction_rows))),
        'shape':round(shape_total/denominator),
        'completeness':round(100*max(0,1-(sum(r['status']=='missing' for r in rows)+sum(r['status']=='extra' for r in rows))/max(1,len(reference))))}
    overall = round(sum(scores[key]*weight for key,weight in cfg.SCORE_WEIGHTS.items()))
    return {'version':cfg.VERSION,'strictness':strictness,'thresholds':dict(thresholds),'score_weights':dict(cfg.SCORE_WEIGHTS),'pass_score':cfg.PASS_SCORE,'provisional':not final,'strokes':rows,'scores':scores,'overall_score':overall,
            'passed':bool(final and overall>=cfg.PASS_SCORE and len(user)==len(reference) and all(r['status']=='correct' for r in rows)),
            'evidence_counts': {'order':len(order_rows), 'direction':len(direction_rows), 'matched':len(present)},
            'expected_count':len(reference),'actual_count':len(user)}
