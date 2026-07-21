import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
import uuid
from database import players, queue, active_matches

from services.player_service import (
    get_or_create_player,
    find_player,
    apply_match_result,
    mark_tutorial_done,
    claim_welcome_reward,
    TutorialIncompleteError,
    WelcomeRewardUnavailableError,
)

from services.contest_service import featured, categories

from data.contests import CONTESTS

from data.shop import SHOP_ITEMS
from data.gear import GEAR

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger = logging.getLogger(__name__)


@app.get("/api/health")
def health():
    """Lightweight process health check for hosting platforms."""
    return {"status": "ok"}

# =========================
# MEMORY DATABASE
# =========================



# =========================
# MODELS
# =========================

class PlayerCreate(BaseModel):
    device_id: str

class MatchResult(BaseModel):
    device_id: str
    opponent_id: str
    score: int
    won: bool = False

# =========================
# ROOT TEST
# =========================

@app.get("/api/")
def root():
    return {
        "ok": True,
        "message": "Backend is working 🚀",
        "mongo_connected": True
    }

@app.get("/api/test")
def test():
    return {"ok": True}

# =========================
# PLAYER SYSTEM
# =========================

@app.post("/api/player")
def create_player_endpoint(data: PlayerCreate):
    return get_or_create_player(data.device_id)


@app.post("/api/player/tutorial_done")
def tutorial_done_endpoint(data: PlayerCreate):
    player = mark_tutorial_done(data.device_id)

    if not player:
        raise HTTPException(status_code=404, detail="player not found")

    return player


@app.post("/api/player/welcome_reward")
def welcome_reward_endpoint(data: PlayerCreate):
    try:
        result = claim_welcome_reward(data.device_id)
    except TutorialIncompleteError:
        raise HTTPException(status_code=409, detail="tutorial must be completed first")
    except WelcomeRewardUnavailableError:
        raise HTTPException(status_code=409, detail="welcome reward is not available for this player")

    if not result:
        raise HTTPException(status_code=404, detail="player not found")

    return result


@app.get("/api/player/{device_id}")
def get_player_endpoint(device_id: str):
    player = find_player(device_id)
    return player if player else {"error": "player not found"}

# =========================
# MATCHMAKING
# =========================

@app.post("/api/matchmaking/join")
def join_queue(data: PlayerCreate):
    device_id = data.device_id

    if device_id not in players:
        return {"error": "player not found"}

    player = players[device_id]

    # prevent duplicates
    for p in queue:
        if p["device_id"] == device_id:
            return {"status": "waiting"}

    queue.append({
        "device_id": device_id,
        "elo": player["elo"],
        "time": time.time()
    })

    # try match
    for p in queue:
        if p["device_id"] == device_id:
            continue

        if abs(p["elo"] - player["elo"]) <= 200:
            queue.remove(p)

            match_id = str(uuid.uuid4())

            active_matches[match_id] = {
                "players": [device_id, p["device_id"]],
                "created": time.time()
            }

            return {
                "status": "matched",
                "match_id": match_id,
                "opponent": p["device_id"]
            }

    return {"status": "waiting"}


@app.get("/api/matchmaking/status/{device_id}")
def matchmaking_status(device_id: str):
    for match_id, match in active_matches.items():
        if device_id in match["players"]:
            return {
                "status": "matched",
                "match_id": match_id,
                "players": match["players"]
            }

    return {"status": "searching"}


@app.post("/api/matchmaking/leave")
def leave_queue(data: PlayerCreate):
    global queue
    queue = [p for p in queue if p["device_id"] != data.device_id]

    return {"status": "left"}

# =========================
# MATCH RESULT + ELO
# =========================

@app.post("/api/match/result")
def match_result(data: MatchResult):
    player = find_player(data.device_id)
    opponent = find_player(data.opponent_id)

    if not player or not opponent:
        return {"error": "player not found"}

    updated_player = apply_match_result(data.device_id, data.opponent_id, data.won)

    return {
        "status": "ok",
        "player_elo": updated_player["elo"],
    }

# =========================
# SHOP / GEAR
# =========================

@app.get("/api/shop")
def shop():
    return {"items": SHOP_ITEMS}


@app.get("/api/gear")
def gear():
    return {"items": GEAR}

# =========================
# DEBUG
# =========================

@app.get("/api/debug-db")
def debug():
    return {
        "players": len(players),
        "queue": len(queue),
        "matches": len(active_matches)
    }

# =========================
# CONTEST ROUTES
# =========================

@app.get("/api/contests")
def contests():
    """Return the local contest catalog without any external dependencies."""
    try:
        return {"contests": CONTESTS}
    except Exception as exc:
        logger.exception("Unable to load the contest catalog")
        raise HTTPException(
            status_code=500,
            detail="Unable to load the contest catalog",
        ) from exc


@app.get("/api/featured-contest")
def get_featured_contest():
    return {"contest": featured()}


@app.get("/api/contest-categories")
def get_categories():
    return {"categories": categories()}
