"""Server-owned promotional campaign configuration."""

import os

CRUISE_DUCK_CAMPAIGN = "cruise-duck-2026"
CRUISE_DUCK_REWARD_COINS = 500
CRUISE_DUCK_CODE_COUNT = 100
CRUISE_DUCK_ENABLED = os.environ.get("FIRE_FEAST_CRUISE_DUCK_ENABLED", "true").lower() == "true"
