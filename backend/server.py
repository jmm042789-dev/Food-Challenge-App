from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

# ---------------- Static catalogs ----------------
# bite_mechanic options: tap | swipe | hold_release | rapid
CONTESTS = [
    {
        "id": "nathans-hotdogs",
        "name": "Coney Beach Dog Derby",
        "location": "Coney Beach, NY",
        "food": "Hot Dogs",
        "food_emoji": "🌭",
        "entry_fee": 50,
        "prize_pool": 500,
        "difficulty": "Legendary",
        "duration_sec": 30,
        "image": "https://images.unsplash.com/photo-1542344807-21226ec94b39?crop=entropy&cs=srgb&fm=jpg&w=1080",
        "heartburn_per_bite": 2,
        "color": "#FF2A00",
        "bite_mechanic": "tap",
    },
    {
        "id": "wing-bowl",
        "name": "Liberty Bell Wing Brawl",
        "location": "Liberty City, PA",
        "food": "Spicy Wings",
        "food_emoji": "🍗",
        "entry_fee": 30,
        "prize_pool": 300,
        "difficulty": "Hard",
        "duration_sec": 25,
        "image": "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?crop=entropy&cs=srgb&fm=jpg&w=1080",
        "heartburn_per_bite": 3,
        "color": "#E05A00",
        "bite_mechanic": "swipe",
    },
    {
        "id": "pizza-hut-stuffed",
        "name": "Stuffed Crust Slam",
        "location": "Heartland, KS",
        "food": "Stuffed Crust Pizza",
        "food_emoji": "🍕",
        "entry_fee": 25,
        "prize_pool": 250,
        "difficulty": "Medium",
        "duration_sec": 30,
        "image": "https://images.unsplash.com/photo-1595708684082-a173bb3a06c5?crop=entropy&cs=srgb&fm=jpg&w=1080",
        "heartburn_per_bite": 2,
        "color": "#FFB800",
        "bite_mechanic": "swipe",
    },
    {
        "id": "katz-pastrami",
        "name": "Lower East Pastrami Pile-Up",
        "location": "Lower East, NY",
        "food": "Pastrami Sandwich",
        "food_emoji": "🥪",
        "entry_fee": 20,
        "prize_pool": 200,
        "difficulty": "Medium",
        "duration_sec": 30,
        "image": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?crop=entropy&cs=srgb&fm=jpg&w=1080",
        "heartburn_per_bite": 2,
        "color": "#7B3F00",
        "bite_mechanic": "tap",
    },
    {
        "id": "ben-jerry-icecream",
        "name": "Vermont Brain Freeze Bash",
        "location": "Maple Hills, VT",
        "food": "Ice Cream",
        "food_emoji": "🍦",
        "entry_fee": 15,
        "prize_pool": 150,
        "difficulty": "Easy",
        "duration_sec": 25,
        "image": "https://images.unsplash.com/photo-1576506295286-5cda18df43e7?crop=entropy&cs=srgb&fm=jpg&w=1080",
        "heartburn_per_bite": 1,
        "color": "#FF6FA8",
        "bite_mechanic": "hold_release",
    },
    {
        "id": "in-n-out-burgers",
        "name": "West Coast Animal Burger Bash",
        "location": "Sunset City, CA",
        "food": "Burgers",
        "food_emoji": "🍔",
        "entry_fee": 35,
        "prize_pool": 350,
        "difficulty": "Hard",
        "duration_sec": 30,
        "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?crop=entropy&cs=srgb&fm=jpg&w=1080",
        "heartburn_per_bite": 3,
        "color": "#D62828",
        "bite_mechanic": "rapid",
    },
]

# Tutorial contest — easier opponent + simpler stakes
TUTORIAL_CONTEST = {
    "id": "tutorial",
    "name": "Backyard Practice Match",
    "location": "Your Kitchen",
    "food": "Mini Sliders",
    "food_emoji": "🍔",
    "entry_fee": 0,
    "prize_pool": 100,
    "difficulty": "Tutorial",
    "duration_sec": 20,
    "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?crop=entropy&cs=srgb&fm=jpg&w=1080",
    "heartburn_per_bite": 1,
    "color": "#39FF14",
    "bite_mechanic": "tap",
}

TUTORIAL_OPPONENT = {
    "id": "ai-tutorial",
    "name": "Lil' Crumbs",
    "country": "🌱",
    "personality": "nervous trainee who is just learning to chew",
    "skill": 0.45,
    "avatar_color": "#39FF14",
}

AI_OPPONENTS = [
    {"id": "ai-1", "name": "\"The Champ\" Jolt Carver", "country": "🇺🇸", "personality": "cocky reigning champion who taunts every bite", "skill": 0.95, "avatar_color": "#FF2A00"},
    {"id": "ai-2", "name": "Tatsu Komodo", "country": "🇯🇵", "personality": "silent assassin, calm and methodical", "skill": 0.92, "avatar_color": "#FFB800"},
    {"id": "ai-3", "name": "Polly Sharpshooter", "country": "🇺🇸", "personality": "speedy gum-chewer rookie that hypes herself up", "skill": 0.85, "avatar_color": "#FF6FA8"},
    {"id": "ai-4", "name": "Raging Russ", "country": "🇨🇦", "personality": "loud showman who lifts weights between bites", "skill": 0.88, "avatar_color": "#39FF14"},
    {"id": "ai-5", "name": "Gus \"MegaGulp\"", "country": "🇺🇸", "personality": "monstrous appetite, growls and roars", "skill": 0.90, "avatar_color": "#E05A00"},
    {"id": "ai-6", "name": "Niki Sun", "country": "🇺🇸", "personality": "graceful and ruthless, queen energy", "skill": 0.93, "avatar_color": "#FFB800"},
]

# Daily reward 7-day cycle
DAILY_REWARDS = [
    {"day": 1, "type": "coins", "qty": 100, "icon": "🪙"},
    {"day": 2, "type": "coins", "qty": 200, "icon": "🪙"},
    {"day": 3, "type": "tums",  "qty": 3,   "icon": "💊"},
    {"day": 4, "type": "coins", "qty": 300, "icon": "🪙"},
    {"day": 5, "type": "coins", "qty": 500, "icon": "💰"},
    {"day": 6, "type": "tums",  "qty": 5,   "icon": "💊"},
    {"day": 7, "type": "bundle","qty": 1000,"icon": "🎁", "bonus_tums": 5, "bonus_gear": "gear-golden-bib"},
]

# Shop items now include gear
SHOP_ITEMS = [
    # Tums (buy with coins)
    {"id": "tums-5",  "type": "tums",  "name": "Tums Pocket",     "qty": 5,  "price": 100, "icon": "💊"},
    {"id": "tums-15", "type": "tums",  "name": "Tums Bottle",     "qty": 15, "price": 250, "icon": "💊"},
    {"id": "tums-50", "type": "tums",  "name": "Tums Mega Crate", "qty": 50, "price": 750, "icon": "💊"},
    # Coins (mock real money)
    {"id": "coins-500",  "type": "coins", "name": "Coin Pouch", "qty": 500,  "price_usd": 0.99, "icon": "🪙"},
    {"id": "coins-2500", "type": "coins", "name": "Coin Sack",  "qty": 2500, "price_usd": 4.99, "icon": "💰"},
    {"id": "coins-7000", "type": "coins", "name": "Coin Vault", "qty": 7000, "price_usd": 9.99, "icon": "💎"},
    # Gear (buy with coins, owned permanently, only one equipped at a time)
    {"id": "gear-lucky-bib",     "type": "gear", "name": "Lucky Bib",     "price": 400,  "icon": "🎽", "perk": "Once per match, survive a heartburn KO with 30 HP restored", "perk_key": "lucky_bib"},
    {"id": "gear-stretchy-belt", "type": "gear", "name": "Stretchy Belt", "price": 600,  "icon": "🥋", "perk": "+20 max belly capacity", "perk_key": "stretchy_belt"},
    {"id": "gear-golden-spoon",  "type": "gear", "name": "Golden Spoon",  "price": 800,  "icon": "🥄", "perk": "+20% coin reward on wins", "perk_key": "golden_spoon"},
    {"id": "gear-iron-stomach",  "type": "gear", "name": "Iron Stomach",  "price": 1000, "icon": "⚙️", "perk": "Heartburn fills 25% slower", "perk_key": "iron_stomach"},
    {"id": "gear-golden-bib",    "type": "gear", "name": "Golden Bib",    "price": 0,    "icon": "🏅", "perk": "Daily-7 reward: cosmetic prestige flair", "perk_key": "golden_bib", "unlock_only": True},
]

BOT_PLAYERS = [
    ("ChompKing", "🇺🇸", 9821), ("TacoTitan", "🇲🇽", 9540), ("KimchiCrusher", "🇰🇷", 9210),
    ("SushiSlayer", "🇯🇵", 8990), ("CurryCrusher", "🇮🇳", 8745), ("PastaPiledriver", "🇮🇹", 8590),
    ("PoutinePunisher", "🇨🇦", 8421), ("BangersBrawler", "🇬🇧", 8200), ("ChurroChomper", "🇪🇸", 8050),
    ("PretzelPro", "🇩🇪", 7910), ("BaguetteBeast", "🇫🇷", 7780), ("FalafelFury", "🇪🇬", 7650),
    ("PavlovaPredator", "🇦🇺", 7500), ("BorschtBomber", "🇺🇦", 7380), ("BiltongBaron", "🇿🇦", 7220),
    ("ChurrascoChamp", "🇧🇷", 7100), ("AsadoAce", "🇦🇷", 6980), ("DurianDestroyer", "🇲🇾", 6840),
    ("PhoFury", "🇻🇳", 6700), ("RamenRampage", "🇯🇵", 6560),
]

# Belt ranks (XP thresholds)
BELT_RANKS = [
    {"key": "bronze",   "name": "Bronze Belly",     "min_xp": 0,     "color": "#CD7F32", "icon": "🥉"},
    {"key": "silver",   "name": "Silver Stomach",   "min_xp": 200,   "color": "#C0C0C0", "icon": "🥈"},
    {"key": "gold",     "name": "Gold Glutton",     "min_xp": 800,   "color": "#FFB800", "icon": "🥇"},
    {"key": "platinum", "name": "Platinum Plate",   "min_xp": 2000,  "color": "#E5E4E2", "icon": "🏆"},
    {"key": "diamond",  "name": "Diamond Devourer", "min_xp": 5000,  "color": "#7AB8FF", "icon": "💎"},
]

# Tournaments — rotated weekly. Each week uses a contest_id from the catalog with bonus prize multiplier.
TOURNAMENT_ROTATION = [
    {"contest_id": "wing-bowl",          "title": "Hot Sauce Havoc",   "prize_mult": 2.5, "tag": "🔥 SPICY WEEK"},
    {"contest_id": "nathans-hotdogs",    "title": "Hot Dog Hammer",    "prize_mult": 3.0, "tag": "🌭 GLORY WEEK"},
    {"contest_id": "pizza-hut-stuffed",  "title": "Cheese Pull Classic","prize_mult": 2.0,"tag": "🧀 CHEESE WEEK"},
    {"contest_id": "in-n-out-burgers",   "title": "Animal Style Open", "prize_mult": 2.5, "tag": "🍔 BURGER WEEK"},
    {"contest_id": "katz-pastrami",      "title": "Deli Dynasty Cup",  "prize_mult": 2.0, "tag": "🥪 DELI WEEK"},
    {"contest_id": "ben-jerry-icecream", "title": "Brain Freeze Bowl", "prize_mult": 2.0, "tag": "🍦 SUMMER WEEK"},
]

REFILL_INTERVAL_MIN = 30
MAX_FREE_TUMS = 5

# ---------------- Models ----------------
class Player(BaseModel):
    device_id: str
    username: str = "Hungry Hero"
    avatar_emoji: str = "🤤"
    country: str = "🌍"
    coins: int = 200
    tums: int = 5
    xp: int = 0
    wins: int = 0
    matches: int = 0
    best_score: int = 0
    last_tums_refill: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    # New fields
    owned_gear: List[str] = Field(default_factory=list)
    equipped_gear: Optional[str] = None
    streak_days: int = 0
    last_claim_date: Optional[str] = None   # YYYY-MM-DD
    tutorial_done: bool = False

class PlayerCreate(BaseModel):
    device_id: str
    username: Optional[str] = None
    country: Optional[str] = None
    avatar_emoji: Optional[str] = None

class PlayerUpdate(BaseModel):
    username: Optional[str] = None
    country: Optional[str] = None
    avatar_emoji: Optional[str] = None

class EquipRequest(BaseModel):
    device_id: str
    gear_id: Optional[str]   # null = unequip

class TutorialDoneRequest(BaseModel):
    device_id: str

class MatchResult(BaseModel):
    device_id: str
    contest_id: str
    score: int
    duration_sec: int
    won: bool
    opponent_id: str
    tums_used: int = 0
    is_tournament: bool = False

class PurchaseRequest(BaseModel):
    device_id: str
    item_id: str

class TrashTalkRequest(BaseModel):
    opponent_id: str
    contest_id: str
    event: str
    player_score: int = 0
    opponent_score: int = 0

class DailyClaimRequest(BaseModel):
    device_id: str

# ---------------- Helpers ----------------
def belt_for_xp(xp: int) -> dict:
    current = BELT_RANKS[0]
    for r in BELT_RANKS:
        if xp >= r["min_xp"]:
            current = r
    return current

def player_with_extras(doc: dict) -> dict:
    rank = belt_for_xp(doc.get("xp", 0))
    next_rank = next((r for r in BELT_RANKS if r["min_xp"] > doc.get("xp", 0)), None)
    doc["belt"] = rank
    doc["next_belt"] = next_rank
    # active perks for equipped gear
    gear = next((g for g in SHOP_ITEMS if g["id"] == doc.get("equipped_gear")), None)
    doc["equipped_perk"] = gear["perk_key"] if gear else None
    return doc

def refill_tums(player_doc: dict) -> dict:
    try:
        last = datetime.fromisoformat(player_doc.get("last_tums_refill"))
    except Exception:
        last = datetime.now(timezone.utc)
    now = datetime.now(timezone.utc)
    if player_doc.get("tums", 0) < MAX_FREE_TUMS:
        minutes_passed = (now - last).total_seconds() / 60
        refills = int(minutes_passed // REFILL_INTERVAL_MIN)
        if refills > 0:
            new_tums = min(MAX_FREE_TUMS, player_doc.get("tums", 0) + refills)
            player_doc["tums"] = new_tums
            new_last = last + timedelta(minutes=refills * REFILL_INTERVAL_MIN)
            player_doc["last_tums_refill"] = new_last.isoformat()
    else:
        player_doc["last_tums_refill"] = now.isoformat()
    return player_doc

async def get_or_create_player(device_id: str) -> dict:
    doc = await db.players.find_one({"device_id": device_id}, {"_id": 0})
    if not doc:
        p = Player(device_id=device_id)
        await db.players.insert_one(p.model_dump())
        doc = p.model_dump()
    # ensure new fields exist on legacy players
    defaults = {
        "owned_gear": [], "equipped_gear": None,
        "streak_days": 0, "last_claim_date": None, "tutorial_done": False,
    }
    missing = {k: v for k, v in defaults.items() if k not in doc}
    if missing:
        doc.update(missing)
        await db.players.update_one({"device_id": device_id}, {"$set": missing})
    doc = refill_tums(doc)
    await db.players.update_one({"device_id": device_id}, {"$set": {"tums": doc["tums"], "last_tums_refill": doc["last_tums_refill"]}})
    return doc

def pick_opponent(contest_id: str) -> dict:
    return random.choice(AI_OPPONENTS)

def today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

def current_tournament() -> dict:
    # rotate weekly based on ISO week number
    week_idx = datetime.now(timezone.utc).isocalendar().week % len(TOURNAMENT_ROTATION)
    t = TOURNAMENT_ROTATION[week_idx]
    contest = next((c for c in CONTESTS if c["id"] == t["contest_id"]), CONTESTS[0])
    # next monday 00:00 UTC
    now = datetime.now(timezone.utc)
    days_until_monday = (7 - now.weekday()) % 7 or 7
    ends_at = (now + timedelta(days=days_until_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
    return {
        "title": t["title"], "tag": t["tag"], "prize_mult": t["prize_mult"],
        "contest": contest, "ends_at": ends_at.isoformat(),
        "boosted_prize": int(contest["prize_pool"] * t["prize_mult"]),
    }

# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"message": "Chomp Champs API live"}

@api_router.post("/player")
async def create_or_get_player(data: PlayerCreate):
    doc = await get_or_create_player(data.device_id)
    update = {}
    if data.username:
        update["username"] = data.username
    if data.country:
        update["country"] = data.country
    if data.avatar_emoji:
        update["avatar_emoji"] = data.avatar_emoji
    if update:
        await db.players.update_one({"device_id": data.device_id}, {"$set": update})
        doc.update(update)
    return player_with_extras(doc)

@api_router.get("/player/{device_id}")
async def get_player(device_id: str):
    doc = await get_or_create_player(device_id)
    return player_with_extras(doc)

@api_router.patch("/player/{device_id}")
async def update_player(device_id: str, data: PlayerUpdate):
    doc = await get_or_create_player(device_id)
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        await db.players.update_one({"device_id": device_id}, {"$set": update})
        doc.update(update)
    return player_with_extras(doc)

@api_router.post("/player/equip")
async def equip_gear(req: EquipRequest):
    player = await get_or_create_player(req.device_id)
    if req.gear_id is not None and req.gear_id not in player.get("owned_gear", []):
        raise HTTPException(400, "You do not own that gear")
    await db.players.update_one({"device_id": req.device_id}, {"$set": {"equipped_gear": req.gear_id}})
    player["equipped_gear"] = req.gear_id
    return player_with_extras(player)

@api_router.post("/player/tutorial_done")
async def mark_tutorial(req: TutorialDoneRequest):
    await db.players.update_one({"device_id": req.device_id}, {"$set": {"tutorial_done": True}})
    doc = await get_or_create_player(req.device_id)
    return player_with_extras(doc)

@api_router.get("/contests")
async def list_contests():
    return {"contests": CONTESTS}

@api_router.get("/contest/{contest_id}")
async def get_contest(contest_id: str):
    if contest_id == "tutorial":
        return TUTORIAL_CONTEST
    contest = next((c for c in CONTESTS if c["id"] == contest_id), None)
    if not contest:
        raise HTTPException(404, "Contest not found")
    return contest

@api_router.post("/match/start")
async def match_start(payload: dict):
    device_id = payload.get("device_id")
    contest_id = payload.get("contest_id")
    is_tutorial = contest_id == "tutorial"
    if not device_id or not contest_id:
        raise HTTPException(400, "device_id and contest_id required")
    if is_tutorial:
        contest = TUTORIAL_CONTEST
        opponent = TUTORIAL_OPPONENT
    else:
        contest = next((c for c in CONTESTS if c["id"] == contest_id), None)
        if not contest:
            raise HTTPException(404, "Contest not found")
        opponent = pick_opponent(contest_id)
    player = await get_or_create_player(device_id)
    if not is_tutorial and player["coins"] < contest["entry_fee"]:
        raise HTTPException(400, "Not enough coins")
    new_coins = player["coins"]
    if not is_tutorial:
        new_coins -= contest["entry_fee"]
        await db.players.update_one({"device_id": device_id}, {"$set": {"coins": new_coins}})
    opp_pace = opponent["skill"] * (6 if contest["difficulty"] == "Easy" else 8 if contest["difficulty"] == "Medium" else 9.5 if contest["difficulty"] == "Hard" else 11 if contest["difficulty"] == "Legendary" else 4)
    return {
        "contest": contest, "opponent": opponent, "opp_pace_per_sec": opp_pace,
        "player_tums": player["tums"], "player_coins": new_coins,
        "equipped_gear": player.get("equipped_gear"),
        "equipped_perk": next((g["perk_key"] for g in SHOP_ITEMS if g["id"] == player.get("equipped_gear")), None),
    }

@api_router.post("/match/result")
async def submit_match_result(result: MatchResult):
    player = await get_or_create_player(result.device_id)
    contest = next((c for c in CONTESTS if c["id"] == result.contest_id), TUTORIAL_CONTEST if result.contest_id == "tutorial" else None)
    if contest is None:
        raise HTTPException(404, "Contest not found")
    coin_reward = 0
    xp_reward = 0
    base_prize = contest["prize_pool"]
    if result.is_tournament:
        t = current_tournament()
        if t["contest"]["id"] == result.contest_id:
            base_prize = t["boosted_prize"]
    if result.won:
        coin_reward = base_prize
        xp_reward = 50
        # golden spoon bonus
        if player.get("equipped_gear") == "gear-golden-spoon":
            coin_reward = int(coin_reward * 1.2)
    else:
        coin_reward = 10
        xp_reward = 15
    new_coins = player["coins"] + coin_reward
    new_xp = player["xp"] + xp_reward
    new_wins = player["wins"] + (1 if result.won else 0)
    new_matches = player["matches"] + 1
    new_best = max(player["best_score"], result.score)
    new_tums = max(0, player["tums"] - result.tums_used)
    old_belt = belt_for_xp(player["xp"])["key"]
    new_belt = belt_for_xp(new_xp)["key"]
    leveled_up = old_belt != new_belt
    await db.players.update_one(
        {"device_id": result.device_id},
        {"$set": {"coins": new_coins, "xp": new_xp, "wins": new_wins, "matches": new_matches, "best_score": new_best, "tums": new_tums}}
    )
    await db.matches.insert_one({
        "id": str(uuid.uuid4()),
        "device_id": result.device_id,
        "contest_id": result.contest_id,
        "score": result.score,
        "duration_sec": result.duration_sec,
        "won": result.won,
        "opponent_id": result.opponent_id,
        "tums_used": result.tums_used,
        "is_tournament": result.is_tournament,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "coin_reward": coin_reward, "xp_reward": xp_reward,
        "new_coins": new_coins, "new_xp": new_xp, "new_best": new_best, "new_tums": new_tums,
        "leveled_up": leveled_up,
        "new_belt": belt_for_xp(new_xp),
    }

@api_router.get("/leaderboard")
async def leaderboard():
    players = await db.players.find({}, {"_id": 0}).to_list(200)
    real_entries = [
        {"username": p["username"], "country": p.get("country", "🌍"), "score": p.get("best_score", 0),
         "avatar": p.get("avatar_emoji", "🤤"), "is_you": False, "device_id": p.get("device_id", ""),
         "belt": belt_for_xp(p.get("xp", 0))}
        for p in players if p.get("best_score", 0) > 0
    ]
    bot_entries = [
        {"username": n, "country": c, "score": s, "avatar": "🤖", "is_you": False, "device_id": None,
         "belt": belt_for_xp(s * 2)}
        for (n, c, s) in BOT_PLAYERS
    ]
    merged = real_entries + bot_entries
    merged.sort(key=lambda x: x["score"], reverse=True)
    for i, e in enumerate(merged, start=1):
        e["rank"] = i
    return {"leaderboard": merged[:50]}

@api_router.get("/shop")
async def shop():
    return {"items": [i for i in SHOP_ITEMS if not i.get("unlock_only")]}

@api_router.get("/gear")
async def gear_catalog():
    return {"items": [i for i in SHOP_ITEMS if i["type"] == "gear"]}

@api_router.post("/purchase")
async def purchase(req: PurchaseRequest):
    player = await get_or_create_player(req.device_id)
    item = next((i for i in SHOP_ITEMS if i["id"] == req.item_id), None)
    if not item:
        raise HTTPException(404, "Item not found")
    update = {}
    if item["type"] == "tums":
        price = item["price"]
        if player["coins"] < price:
            raise HTTPException(400, "Not enough coins")
        update["coins"] = player["coins"] - price
        update["tums"] = player["tums"] + item["qty"]
    elif item["type"] == "coins":
        update["coins"] = player["coins"] + item["qty"]
    elif item["type"] == "gear":
        if item["id"] in player.get("owned_gear", []):
            raise HTTPException(400, "Already owned")
        if item.get("price", 0) > 0 and player["coins"] < item["price"]:
            raise HTTPException(400, "Not enough coins")
        update["coins"] = player["coins"] - item.get("price", 0)
        update["owned_gear"] = player.get("owned_gear", []) + [item["id"]]
    await db.players.update_one({"device_id": req.device_id}, {"$set": update})
    final = await get_or_create_player(req.device_id)
    return {
        "ok": True,
        "new_coins": final.get("coins"),
        "new_tums": final.get("tums"),
        "owned_gear": final.get("owned_gear", []),
    }

# ---- Daily reward ----
@api_router.get("/daily/status/{device_id}")
async def daily_status(device_id: str):
    player = await get_or_create_player(device_id)
    today = today_str()
    available = player.get("last_claim_date") != today
    streak = player.get("streak_days", 0)
    next_day = (streak % 7) + 1
    reward = DAILY_REWARDS[next_day - 1]
    return {"available": available, "streak_days": streak, "next_day": next_day, "next_reward": reward, "schedule": DAILY_REWARDS}

@api_router.post("/daily/claim")
async def daily_claim(req: DailyClaimRequest):
    player = await get_or_create_player(req.device_id)
    today = today_str()
    if player.get("last_claim_date") == today:
        raise HTTPException(400, "Already claimed today")
    # streak: if last_claim was yesterday, +1; else reset to 1
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    new_streak = player.get("streak_days", 0) + 1 if player.get("last_claim_date") == yesterday else 1
    day_idx = ((new_streak - 1) % 7) + 1
    reward = DAILY_REWARDS[day_idx - 1]
    update = {"last_claim_date": today, "streak_days": new_streak}
    if reward["type"] == "coins":
        update["coins"] = player["coins"] + reward["qty"]
    elif reward["type"] == "tums":
        update["tums"] = player["tums"] + reward["qty"]
    elif reward["type"] == "bundle":
        update["coins"] = player["coins"] + reward["qty"]
        update["tums"] = player["tums"] + reward.get("bonus_tums", 0)
        bonus_gear = reward.get("bonus_gear")
        if bonus_gear and bonus_gear not in player.get("owned_gear", []):
            update["owned_gear"] = player.get("owned_gear", []) + [bonus_gear]
    await db.players.update_one({"device_id": req.device_id}, {"$set": update})
    final = await get_or_create_player(req.device_id)
    return {"reward": reward, "day": day_idx, "streak_days": new_streak, "player": player_with_extras(final)}

# ---- Tournament ----
@api_router.get("/tournament")
async def get_tournament():
    return current_tournament()

# ---- LLM Trash talk ----
@api_router.post("/trashtalk")
async def trashtalk(req: TrashTalkRequest):
    if req.opponent_id == "ai-tutorial":
        opponent = TUTORIAL_OPPONENT
    else:
        opponent = next((o for o in AI_OPPONENTS if o["id"] == req.opponent_id), AI_OPPONENTS[0])
    contest = TUTORIAL_CONTEST if req.contest_id == "tutorial" else next((c for c in CONTESTS if c["id"] == req.contest_id), CONTESTS[0])
    fallback = {
        "start": f"{opponent['name']}: You sure about this, kid? I eat {contest['food']} for breakfast.",
        "midmatch_ahead": f"{opponent['name']}: Catch up or go home!",
        "midmatch_behind": f"{opponent['name']}: I'm just warming up...",
        "win": f"{opponent['name']}: GG. Better luck next time, lightweight.",
        "lose": f"{opponent['name']}: Lucky bite! I'll get you next round.",
    }
    if not EMERGENT_LLM_KEY:
        return {"line": fallback.get(req.event, fallback["start"])}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        system_msg = (
            f"You are {opponent['name']}, a {opponent['personality']} competitive eater at the "
            f"{contest['name']} eating contest. Generate ONE short, punchy trash-talk line "
            "in your own voice. Max 15 words. No quotes around it. No emojis. Be cheeky, not cruel."
        )
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"trash-{req.opponent_id}-{req.event}",
            system_message=system_msg,
        ).with_model("anthropic", "claude-sonnet-4-6")
        user_text = {
            "start": "Match is starting. Player score 0, your score 0. Trash-talk to intimidate.",
            "midmatch_ahead": f"You are ahead {req.opponent_score} to {req.player_score}. Boast.",
            "midmatch_behind": f"You are behind {req.opponent_score} to {req.player_score}. Stay confident.",
            "win": f"You won {req.opponent_score} to {req.player_score}. Gloat briefly.",
            "lose": f"You lost {req.opponent_score} to {req.player_score}. Sour grapes.",
        }.get(req.event, "Trash talk.")
        msg = UserMessage(text=user_text)
        resp = await asyncio.wait_for(chat.send_message(msg), timeout=8.0)
        line = str(resp).strip().strip('"').strip("'")
        if not line:
            line = fallback[req.event]
        return {"line": f"{opponent['name']}: {line}"}
    except Exception as e:
        logger.warning(f"trashtalk LLM error: {e}")
        return {"line": fallback.get(req.event, fallback["start"])}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
