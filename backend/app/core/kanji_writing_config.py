"""Heuristic thresholds in whole-character normalized coordinates, versioned for audits."""
VERSION = 'stroke-rules-v4'
SAMPLES = 32
DISTANCE = 0.115
ENDPOINT = 0.19
LENGTH_RATIO = 0.48
ALTERNATE_MARGIN = 0.025
CONFUSION_MARGIN = 0.012
CONFUSION_DISTANCE = 0.18
PASS_SCORE = 80
SCORE_WEIGHTS = {'order': .2, 'direction': .2, 'shape': .4, 'completeness': .2}
SHAPE_DISTANCE_TOLERANCE = .025
SHAPE_DISTANCE_MULTIPLIER = 2.0
DIRECTION_EVIDENCE_DISTANCE_FACTOR = 1.5
DIRECTION_EVIDENCE_LENGTH_RATIO = .3
DIRECTION_REVERSE_MARGIN = .006
DIRECTION_COSINE_LIMIT = -.25
MATCH_ENDPOINT_WEIGHT = .15
MATCH_LENGTH_WEIGHT = .025
VISIBLE_PROFILES = ('easy', 'standard', 'strict')

# Whole-character units. Profiles are deliberately explicit and returned for audits.
PROFILES = {
    'very_easy': {'distance': .24, 'endpoint': .38, 'length_ratio': .30, 'order_margin': .04},
    'easy': {'distance': .20, 'endpoint': .32, 'length_ratio': .35, 'order_margin': .035},
    'standard': {'distance': .16, 'endpoint': .26, 'length_ratio': .42, 'order_margin': .025},
    'strict': {'distance': .10, 'endpoint': .17, 'length_ratio': .60, 'order_margin': .020},
    'very_strict': {'distance': .085, 'endpoint': .145, 'length_ratio': .65, 'order_margin': .018},
}
CONFUSION_HINT_MAX = .065
CONFUSION_HINT_MARGIN = .035

# With a count gap, require two strongly identified crossing strokes before
# accusing the learner of reordering; a count shift alone is never evidence.
GAP_ORDER_PROOF = {'distance_ratio': .65, 'endpoint_ratio': .75,
                   'length_ratio': .75, 'margin_multiplier': 2.0}
