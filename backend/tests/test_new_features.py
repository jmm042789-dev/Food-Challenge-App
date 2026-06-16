"""Tests for new Chomp Champs features: bite_mechanic, daily reward, tournament,
gear shop, equip, tutorial, belt ranks, and match-result bonuses."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def new_dev():
    return f"TEST_{uuid.uuid4().hex[:10]}"


# ----- Contests bite mechanic -----
class TestBiteMechanic:
    def test_contests_have_bite_mechanic(self, session):
        r = session.get(f"{API}/contests")
        assert r.status_code == 200
        contests = r.json()["contests"]
        valid = {"tap", "swipe", "hold_release", "rapid"}
        for c in contests:
            assert "bite_mechanic" in c, f"missing bite_mechanic on {c['id']}"
            assert c["bite_mechanic"] in valid, f"bad mechanic {c['bite_mechanic']} on {c['id']}"

    def test_specific_mechanic_mapping(self, session):
        contests = {c["id"]: c for c in session.get(f"{API}/contests").json()["contests"]}
        assert contests["wing-bowl"]["bite_mechanic"] == "swipe"
        assert contests["ben-jerry-icecream"]["bite_mechanic"] == "hold_release"
        assert contests["in-n-out-burgers"]["bite_mechanic"] == "rapid"
        assert contests["nathans-hotdogs"]["bite_mechanic"] == "tap"
        assert contests["katz-pastrami"]["bite_mechanic"] == "tap"


# ----- Tournament -----
class TestTournament:
    def test_tournament_shape(self, session):
        r = session.get(f"{API}/tournament")
        assert r.status_code == 200
        t = r.json()
        for f in ["title", "tag", "prize_mult", "contest", "ends_at", "boosted_prize"]:
            assert f in t, f"missing tournament field: {f}"
        assert isinstance(t["prize_mult"], (int, float)) and t["prize_mult"] > 1
        assert t["boosted_prize"] == int(t["contest"]["prize_pool"] * t["prize_mult"])


# ----- Daily reward -----
class TestDaily:
    def test_status_new_player(self, session):
        dev = new_dev()
        # ensure player exists
        session.post(f"{API}/player", json={"device_id": dev})
        r = session.get(f"{API}/daily/status/{dev}")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["available"] is True
        assert body["streak_days"] == 0
        assert body["next_day"] == 1
        assert body["next_reward"]["day"] == 1
        assert isinstance(body["schedule"], list) and len(body["schedule"]) == 7

    def test_claim_grants_day1(self, session):
        dev = new_dev()
        session.post(f"{API}/player", json={"device_id": dev})
        r = session.post(f"{API}/daily/claim", json={"device_id": dev})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["day"] == 1
        assert body["streak_days"] == 1
        assert body["reward"]["qty"] == 100
        # player coins should be 200 + 100 = 300
        p = session.get(f"{API}/player/{dev}").json()
        assert p["coins"] == 300
        assert p["streak_days"] == 1

    def test_claim_twice_same_day_fails(self, session):
        dev = new_dev()
        session.post(f"{API}/player", json={"device_id": dev})
        r1 = session.post(f"{API}/daily/claim", json={"device_id": dev})
        assert r1.status_code == 200
        r2 = session.post(f"{API}/daily/claim", json={"device_id": dev})
        assert r2.status_code == 400


# ----- Shop / Gear -----
class TestGearShop:
    def test_shop_includes_gear(self, session):
        items = session.get(f"{API}/shop").json()["items"]
        ids = {i["id"] for i in items}
        for needed in ["gear-lucky-bib", "gear-stretchy-belt", "gear-golden-spoon", "gear-iron-stomach"]:
            assert needed in ids, f"missing gear: {needed}"
        for g in [i for i in items if i["type"] == "gear"]:
            assert "perk" in g and "perk_key" in g

    def test_gear_only_endpoint(self, session):
        r = session.get(f"{API}/gear")
        assert r.status_code == 200
        items = r.json()["items"]
        assert all(i["type"] == "gear" for i in items)
        assert len(items) >= 4

    def test_purchase_gear_and_duplicate(self, session):
        dev = new_dev()
        # boost coins first
        session.post(f"{API}/purchase", json={"device_id": dev, "item_id": "coins-500"})
        # buy lucky bib (400)
        r = session.post(f"{API}/purchase", json={"device_id": dev, "item_id": "gear-lucky-bib"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "gear-lucky-bib" in body["owned_gear"]
        assert body["new_coins"] == 700 - 400  # 200+500-400 = 300
        # duplicate purchase
        r2 = session.post(f"{API}/purchase", json={"device_id": dev, "item_id": "gear-lucky-bib"})
        assert r2.status_code == 400


# ----- Equip / Tutorial -----
class TestEquipTutorial:
    def test_equip_owned_and_unowned(self, session):
        dev = new_dev()
        session.post(f"{API}/purchase", json={"device_id": dev, "item_id": "coins-500"})
        session.post(f"{API}/purchase", json={"device_id": dev, "item_id": "gear-lucky-bib"})
        # equip owned
        r = session.post(f"{API}/player/equip", json={"device_id": dev, "gear_id": "gear-lucky-bib"})
        assert r.status_code == 200
        assert r.json()["equipped_gear"] == "gear-lucky-bib"
        assert r.json()["equipped_perk"] == "lucky_bib"
        # equip unowned
        r2 = session.post(f"{API}/player/equip", json={"device_id": dev, "gear_id": "gear-iron-stomach"})
        assert r2.status_code == 400
        # clear with null
        r3 = session.post(f"{API}/player/equip", json={"device_id": dev, "gear_id": None})
        assert r3.status_code == 200
        assert r3.json()["equipped_gear"] is None

    def test_tutorial_done(self, session):
        dev = new_dev()
        session.post(f"{API}/player", json={"device_id": dev})
        p = session.get(f"{API}/player/{dev}").json()
        assert p["tutorial_done"] is False
        r = session.post(f"{API}/player/tutorial_done", json={"device_id": dev})
        assert r.status_code == 200
        assert r.json()["tutorial_done"] is True


# ----- Belt ranks -----
class TestBeltRanks:
    def test_player_has_belt_fields(self, session):
        dev = new_dev()
        p = session.post(f"{API}/player", json={"device_id": dev}).json()
        assert "belt" in p
        assert p["belt"]["key"] == "bronze"
        assert p["belt"]["min_xp"] == 0
        assert "next_belt" in p
        assert p["next_belt"]["key"] == "silver"


# ----- Tutorial match -----
class TestTutorialMatch:
    def test_tutorial_match_start(self, session):
        dev = new_dev()
        r = session.post(f"{API}/match/start", json={"device_id": dev, "contest_id": "tutorial"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["contest"]["id"] == "tutorial"
        assert body["contest"]["entry_fee"] == 0
        assert body["opponent"]["id"] == "ai-tutorial"
        assert "Crumbs" in body["opponent"]["name"]
        # coins not deducted
        assert body["player_coins"] == 200


# ----- Match result bonuses -----
class TestMatchResultBonuses:
    def test_tournament_prize_multiplied(self, session):
        # find the tournament contest
        t = session.get(f"{API}/tournament").json()
        cid = t["contest"]["id"]
        boosted = t["boosted_prize"]
        dev = new_dev()
        # give enough coins for entry
        session.post(f"{API}/purchase", json={"device_id": dev, "item_id": "coins-500"})
        session.post(f"{API}/match/start", json={"device_id": dev, "contest_id": cid})
        r = session.post(f"{API}/match/result", json={
            "device_id": dev, "contest_id": cid, "score": 30, "duration_sec": 25,
            "won": True, "opponent_id": "ai-1", "tums_used": 0, "is_tournament": True,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["coin_reward"] == boosted
        # leveled_up + new_belt fields
        assert "leveled_up" in body
        assert "new_belt" in body and "key" in body["new_belt"]

    def test_golden_spoon_bonus(self, session):
        dev = new_dev()
        # give coins, buy golden spoon, equip
        session.post(f"{API}/purchase", json={"device_id": dev, "item_id": "coins-2500"})
        session.post(f"{API}/purchase", json={"device_id": dev, "item_id": "gear-golden-spoon"})
        session.post(f"{API}/player/equip", json={"device_id": dev, "gear_id": "gear-golden-spoon"})
        # win a Ben & Jerry (prize 150). With +20% = 180
        session.post(f"{API}/match/start", json={"device_id": dev, "contest_id": "ben-jerry-icecream"})
        r = session.post(f"{API}/match/result", json={
            "device_id": dev, "contest_id": "ben-jerry-icecream", "score": 22,
            "duration_sec": 25, "won": True, "opponent_id": "ai-2", "tums_used": 0,
        })
        body = r.json()
        assert body["coin_reward"] == int(150 * 1.2)

    def test_level_up_belt(self, session):
        dev = new_dev()
        # 4 wins x 50 xp = 200 → silver
        session.post(f"{API}/purchase", json={"device_id": dev, "item_id": "coins-2500"})
        last = None
        for _ in range(4):
            session.post(f"{API}/match/start", json={"device_id": dev, "contest_id": "ben-jerry-icecream"})
            last = session.post(f"{API}/match/result", json={
                "device_id": dev, "contest_id": "ben-jerry-icecream", "score": 20,
                "duration_sec": 25, "won": True, "opponent_id": "ai-1", "tums_used": 0,
            }).json()
        assert last["new_xp"] >= 200
        assert last["new_belt"]["key"] == "silver"
