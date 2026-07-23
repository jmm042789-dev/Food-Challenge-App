from typing import List, Optional

from pydantic import BaseModel, Field


# ==========================================================
# PLAYER
# ==========================================================

class PlayerCreate(BaseModel):
    device_id: str


class GuestBootstrapRequest(BaseModel):
    installation_id: str = Field(min_length=16, max_length=256)


class PlayerProfileUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=1, max_length=40)
    country: Optional[str] = Field(default=None, max_length=16)
    avatar_emoji: Optional[str] = Field(default=None, max_length=16)


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


class MatchResult(BaseModel):
    device_id: str
    contest_id: str
    opponent_id: str
    score: int = Field(ge=0)
    duration_sec: int = Field(ge=0)
    won: bool = False
    tums_used: int = Field(default=0, ge=0)
    is_tournament: bool = False


class MatchStart(BaseModel):
    device_id: str
    contest_id: str


class PurchaseRequest(BaseModel):
    device_id: str
    item_id: str


class EquipRequest(BaseModel):
    device_id: str
    gear_id: Optional[str] = None


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
