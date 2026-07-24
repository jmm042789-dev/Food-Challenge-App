import unicodedata
from typing import Annotated, List, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


Identifier = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9._:-]+$",
    ),
]


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _clean_display_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("value must not be blank")
    unsafe_categories = {"Cc", "Cs", "Zl", "Zp"}
    if any(
        unicodedata.category(character) in unsafe_categories
        for character in cleaned
    ):
        raise ValueError("control characters are not allowed")
    return cleaned


# ==========================================================
# PLAYER
# ==========================================================

class PlayerCreate(RequestModel):
    device_id: Identifier


class GuestBootstrapRequest(RequestModel):
    installation_id: Identifier = Field(min_length=16, max_length=128)


class PlayerProfileUpdate(RequestModel):
    username: Optional[str] = Field(default=None, min_length=1, max_length=40)
    country: Optional[str] = Field(default=None, max_length=16)
    avatar_emoji: Optional[str] = Field(default=None, max_length=16)

    @field_validator("username", "country", "avatar_emoji")
    @classmethod
    def validate_display_text(cls, value: Optional[str]) -> Optional[str]:
        return _clean_display_text(value)


class Player(BaseModel):
    device_id: str

    coins: int = 0
    antacid: int = 0          # Formerly "tums"
    xp: int = 0

    level: int = 1
    elo: int = 1000

    wins: int = 0
    losses: int = 0
    matches: int = 0

    best_score: int = 0
    longest_combo: int = 0

    owned_gear: List[str] = Field(default_factory=list)
    equipped_gear: Optional[str] = None

    last_claim_date: Optional[str] = None
    streak_days: int = 0
    tutorial_done: bool = False
    welcome_reward_claimed: bool = False


# ==========================================================
# MATCHMAKING
# ==========================================================

class QueuePlayer(BaseModel):
    device_id: str
    elo: int
    joined_at: float


class MatchResult(RequestModel):
    device_id: Identifier
    contest_id: Identifier
    opponent_id: Identifier
    score: int = Field(ge=0, le=10_000_000)
    duration_sec: int = Field(ge=0, le=86_400)
    won: bool = False
    tums_used: int = Field(default=0, ge=0, le=10_000)
    is_tournament: bool = False


class MatchStart(RequestModel):
    device_id: Identifier
    contest_id: Identifier


class PurchaseRequest(RequestModel):
    device_id: Identifier
    item_id: Identifier


class EquipRequest(RequestModel):
    device_id: Identifier
    gear_id: Optional[Identifier] = None


# ==========================================================
# CONTEST
# ==========================================================

class Contest(BaseModel):

    id: str

    name: str

    category: str

    artwork: str

    location: str

    food: str

    food_emoji: str

    entry_fee: int

    prize_pool: int

    difficulty: str

    difficulty_color: str

    duration_sec: int

    image: str

    heartburn_per_bite: int

    color: str

    bite_mechanic: str


# ==========================================================
# SHOP
# ==========================================================

class ShopItem(BaseModel):

    id: str

    name: str

    type: str

    icon: str

    price: int

    perk: str


# ==========================================================
# DAILY REWARD
# ==========================================================

class DailyReward(BaseModel):

    day: int

    coins: int = 0

    xp: int = 0

    antacid: int = 0


# ==========================================================
# HOME SCREEN
# ==========================================================

class HomeResponse(BaseModel):

    player: Player

    featured_contest: Contest

    daily_reward: DailyReward

    tournament: dict

    stats: dict
