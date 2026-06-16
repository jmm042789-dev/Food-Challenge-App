"""Chomp Champs backend API tests"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://eat-battle-arena.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def device_id():
    return f"TEST_{uuid.uuid4().hex[:10]}"


# ---------- Health / root ----------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert "Chomp Champs" in r.json().get("message", "")


# ---------- Contests ----------
class TestContests:
    def test_list_contests(self, session):
        r = session.get(f"{API}/contests")
        assert r.status_code == 200
        contests = r.json().get("contests", [])
        assert len(contests) == 6
        ids = {c["id"] for c in contests}
        for needle in ["nathans-hotdogs", "wing-bowl", "pizza-hut-stuffed", "katz-pastrami", "ben-jerry-icecream", "in-n-out-burgers"]:
            assert needle in ids, f"Missing famous-restaurant id: {needle}"
        # check fields per contest
        for c in contests:
            for f in ["id", "name", "food", "food_emoji", "entry_fee", "prize_pool", "difficulty", "duration_sec", "heartburn_per_bite", "color"]:
                assert f in c, f"Missing field {f} in contest {c.get('id')}"


# ---------- Player ----------
class TestPlayer:
    def test_create_player_defaults(self, session, device_id):
        r = session.post(f"{API}/player", json={"device_id": device_id})
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["device_id"] == device_id
        assert p["coins"] == 200
        assert p["tums"] == 5
        assert p["xp"] == 0
        assert p["wins"] == 0
        assert p["matches"] == 0

    def test_get_player_persistence(self, session, device_id):
        r = session.get(f"{API}/player/{device_id}")
        assert r.status_code == 200
        p = r.json()
        assert p["device_id"] == device_id
        # tums refill won't change since just created
        assert p["tums"] >= 0

    def test_patch_player(self, session, device_id):
        r = session.patch(f"{API}/player/{device_id}", json={"username": "TEST_Hero", "country": "🇮🇳", "avatar_emoji": "🦖"})
        assert r.status_code == 200
        p = r.json()
        assert p["username"] == "TEST_Hero"
        assert p["country"] == "🇮🇳"
        assert p["avatar_emoji"] == "🦖"


# ---------- Match flow ----------
class TestMatchFlow:
    def test_match_start_success(self, session, device_id):
        r = session.post(f"{API}/match/start", json={"device_id": device_id, "contest_id": "ben-jerry-icecream"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "contest" in body
        assert "opponent" in body
        assert "opp_pace_per_sec" in body
        assert body["opp_pace_per_sec"] > 0
        # entry fee 15 → coins now 185
        assert body["player_coins"] == 185

    def test_match_start_insufficient_coins(self, session):
        poor_id = f"TEST_poor_{uuid.uuid4().hex[:6]}"
        # create player
        session.post(f"{API}/player", json={"device_id": poor_id})
        # drain coins by making many starts on cheapest contest? Simpler: try a contest the broke device can't pay
        # Drain manually: do nathans (50) 4 times = 200 → exact zero, then start should fail
        for _ in range(4):
            session.post(f"{API}/match/start", json={"device_id": poor_id, "contest_id": "nathans-hotdogs"})
        r = session.post(f"{API}/match/start", json={"device_id": poor_id, "contest_id": "nathans-hotdogs"})
        assert r.status_code == 400

    def test_match_start_invalid_contest(self, session, device_id):
        r = session.post(f"{API}/match/start", json={"device_id": device_id, "contest_id": "no-such-contest"})
        assert r.status_code == 404

    def test_match_result_win(self, session, device_id):
        # ensure a known starting state
        coins_before = session.get(f"{API}/player/{device_id}").json()["coins"]
        r = session.post(f"{API}/match/result", json={
            "device_id": device_id, "contest_id": "ben-jerry-icecream",
            "score": 42, "duration_sec": 25, "won": True, "opponent_id": "ai-1", "tums_used": 1
        })
        assert r.status_code == 200, r.text
        body = r.json()
        # prize 150 for ben & jerry
        assert body["coin_reward"] == 150
        assert body["xp_reward"] == 50
        assert body["new_coins"] == coins_before + 150
        assert body["new_best"] >= 42

        # verify persistence
        p = session.get(f"{API}/player/{device_id}").json()
        assert p["wins"] >= 1
        assert p["matches"] >= 1
        assert p["best_score"] >= 42

    def test_match_result_loss(self, session, device_id):
        r = session.post(f"{API}/match/result", json={
            "device_id": device_id, "contest_id": "ben-jerry-icecream",
            "score": 5, "duration_sec": 25, "won": False, "opponent_id": "ai-2"
        })
        assert r.status_code == 200
        body = r.json()
        assert body["coin_reward"] == 10
        assert body["xp_reward"] == 15


# ---------- Leaderboard ----------
class TestLeaderboard:
    def test_leaderboard(self, session):
        r = session.get(f"{API}/leaderboard")
        assert r.status_code == 200
        lb = r.json().get("leaderboard", [])
        assert len(lb) > 0
        assert len(lb) <= 50
        # sorted desc
        scores = [e["score"] for e in lb]
        assert scores == sorted(scores, reverse=True)
        # bot players seeded
        usernames = [e["username"] for e in lb]
        assert "ChompKing" in usernames
        # rank assigned
        assert lb[0]["rank"] == 1


# ---------- Shop ----------
class TestShop:
    def test_list_shop(self, session):
        r = session.get(f"{API}/shop")
        assert r.status_code == 200
        items = r.json()["items"]
        # Shop now includes gear too — at least the original 6 tums+coins
        tums = [i for i in items if i["type"] == "tums"]
        coins = [i for i in items if i["type"] == "coins"]
        gear = [i for i in items if i["type"] == "gear"]
        assert len(tums) == 3 and len(coins) == 3
        assert len(gear) >= 4

    def test_purchase_tums(self, session):
        dev = f"TEST_shop_{uuid.uuid4().hex[:6]}"
        session.post(f"{API}/player", json={"device_id": dev})
        # buy tums-5 (cost 100). starting tums=5 coins=200
        r = session.post(f"{API}/purchase", json={"device_id": dev, "item_id": "tums-5"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["new_coins"] == 100
        assert body["new_tums"] == 10

    def test_purchase_coins_pack_mocked(self, session):
        dev = f"TEST_coin_{uuid.uuid4().hex[:6]}"
        session.post(f"{API}/player", json={"device_id": dev})
        r = session.post(f"{API}/purchase", json={"device_id": dev, "item_id": "coins-500"})
        assert r.status_code == 200
        assert r.json()["new_coins"] == 700  # 200 + 500

    def test_purchase_invalid(self, session, device_id):
        r = session.post(f"{API}/purchase", json={"device_id": device_id, "item_id": "no-such"})
        assert r.status_code == 404

    def test_purchase_tums_insufficient(self, session):
        dev = f"TEST_broke_{uuid.uuid4().hex[:6]}"
        session.post(f"{API}/player", json={"device_id": dev})
        # tums-50 costs 750, player has 200
        r = session.post(f"{API}/purchase", json={"device_id": dev, "item_id": "tums-50"})
        assert r.status_code == 400


# ---------- Trashtalk ----------
class TestTrashTalk:
    @pytest.mark.parametrize("event", ["start", "midmatch_ahead", "midmatch_behind", "win", "lose"])
    def test_trashtalk_events(self, session, event):
        r = session.post(f"{API}/trashtalk", json={
            "opponent_id": "ai-1", "contest_id": "nathans-hotdogs",
            "event": event, "player_score": 5, "opponent_score": 8
        })
        assert r.status_code == 200, r.text
        line = r.json().get("line", "")
        assert isinstance(line, str) and len(line) > 0
        # opponent name prefix appears
        assert "Big Joey C." in line or ":" in line
