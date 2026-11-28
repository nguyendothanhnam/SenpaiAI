"""Internal selection policy; callers may override cooldown through constraints."""
import os

LEVELS = ("N5", "N4", "N3", "N2", "N1")
COOLDOWN_DAYS = max(0, int(os.getenv("EXERCISE_COOLDOWN_DAYS", "7")))
REVIEW_INTERVAL_DAYS = (1, 3, 7, 14, 30, 60)
SIMILARITY_THRESHOLD = 0.94
