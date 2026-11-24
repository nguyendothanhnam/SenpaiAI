"""Heuristic thresholds in whole-character normalized coordinates, versioned for audits."""
VERSION = 'stroke-rules-v2'
SAMPLES = 32
DISTANCE = 0.115
ENDPOINT = 0.19
LENGTH_RATIO = 0.48
ALTERNATE_MARGIN = 0.025
CONFUSION_MARGIN = 0.012
CONFUSION_DISTANCE = 0.18
PASS_SCORE = 80

# Whole-character units. Profiles are deliberately explicit and returned for audits.
PROFILES = {
    'easy': {'distance': .20, 'endpoint': .32, 'length_ratio': .35, 'order_margin': .035},
    'standard': {'distance': .16, 'endpoint': .26, 'length_ratio': .42, 'order_margin': .025},
    'strict': {'distance': .10, 'endpoint': .17, 'length_ratio': .60, 'order_margin': .020},
}
CONFUSION_HINT_MAX = .065
CONFUSION_HINT_MARGIN = .035
