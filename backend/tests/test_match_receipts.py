"""Receipt and race tests: production service/database functions, in-memory atomic adapter."""
from copy import deepcopy
from threading import RLock
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from types import SimpleNamespace
import asyncio
import json
import pytest
import database
import server
from services import match_service as service
from tests.test_match_lifecycle import active_match, result, NOW
from tests.test_observability import _asgi_request

IDS = ["nathans-hotdogs", "wing-bowl", "pizza-hut-stuffed", "katz-pastrami", "ben-jerry-icecream", "in-n-out-burgers"]

def evidence(contest="nathans", outcome="settled"):
    return dict(schema_version=1, player_id="player-a", match_id="match-a", contest_id=contest,
                outcome=outcome, rewards_granted=outcome == "settled", settlement_final=True)

def official():
    return dict(verified=True, match_id="match-a", coin_reward=10, xp_reward=15,
                new_coins=110, new_xp=15, new_tums=3, accepted_score=0,
                authoritative_opponent_score=50, won=False, authoritative_outcome="loss")

def settled_player(contest="nathans"):
    return dict(device_id="player-a", coins=110, xp=15, last_match_result={
        "match_id":"match-a", "fingerprint":service._fingerprint(result()),
        "receipt":evidence(contest), "response":official()})

def lookup(player, contest="nathans", match="match-a", owner="player-a"):
    before=deepcopy(player)
    with patch.object(service,"find_internal_player",return_value=player), patch.object(service,"transition_player_match",side_effect=AssertionError("write")), patch.object(service,"settle_player_match",side_effect=AssertionError("write")), patch.object(service,"expire_stale_match",side_effect=AssertionError("expiry")):
        response=service.result_receipt(owner,match,contest)
    assert player==before
    return response

class AtomicPlayers:
    """Narrow adapter, not a claim of live MongoDB qualification."""
    def __init__(self, player): self.player=deepcopy(player); self.lock=RLock(); self.fail=False; self.calls=[]
    def find_one_and_update(self, query, update, **kwargs):
        with self.lock:
            self.calls.append((deepcopy(query),deepcopy(update)))
            def get(path):
                value=self.player
                for key in path.split("."):
                    if not isinstance(value,dict): return None
                    value=value.get(key)
                return value
            if any(get(k)!=v for k,v in query.items()): return None
            def evaluate(v):
                if isinstance(v,str) and v.startswith("$"): return get(v[1:])
                if isinstance(v,list): return [evaluate(x) for x in v]
                if isinstance(v,dict):
                    if "$literal" in v: return deepcopy(v["$literal"])
                    if "$ifNull" in v:
                        a,b=evaluate(v["$ifNull"]);return b if a is None else a
                    if "$add" in v:return sum(evaluate(v["$add"]))
                    if "$subtract" in v:
                        a,b=evaluate(v["$subtract"]);return a-b
                    if "$max" in v:return max(evaluate(v["$max"]))
                    return {k:evaluate(x) for k,x in v.items()}
                return v
            assert isinstance(update,list) and len(update)==1
            fields=update[0]["$set"]
            assert "receipt" in fields["last_match_lifecycle"]
            candidate=deepcopy(self.player)
            for key in ("last_match_lifecycle","last_match_result","coins","xp","antacid"):
                if key in fields:candidate[key]=evaluate(fields[key])
            assert fields["active_match"]=="$$REMOVE"
            candidate.pop("active_match",None)
            if self.fail:raise RuntimeError("injected atomic write failure")
            self.player=candidate
            return deepcopy(candidate)

@pytest.mark.parametrize("contest",IDS)
@pytest.mark.parametrize("outcome",["rejected","expired"])
def test_future_terminal_atomic_receipt_all_contests(contest,outcome):
    active=active_match();active["contest_id"]=contest
    db=AtomicPlayers(dict(device_id="player-a",coins=100,active_match=active))
    with patch.object(database,"_players",return_value=db):
        database.transition_player_match("player-a","match-a",outcome,NOW.isoformat())
    assert db.player["coins"]==100
    for _ in range(2):
        receipt=lookup(db.player,contest)
        assert receipt["status"]=="TERMINAL_NO_REWARD"
        assert receipt["receipt"]==evidence(contest,outcome)
    assert len(db.calls)==1

@pytest.mark.parametrize("contest",IDS)
def test_settled_lookup_all_contests(contest):
    p=settled_player(contest)
    a=lookup(p,contest);b=lookup(p,contest)
    assert a==b and a["status"]=="SETTLED" and a["result"]==official()

@pytest.mark.parametrize("changes",[{"owner":"other"},{"match":"other"},{"contest":"other"}])
def test_identity_mismatch_never_discloses(changes):
    assert lookup(settled_player(),**changes)["status"]=="UNRESOLVED"

@pytest.mark.parametrize("p",[
    {"device_id":"player-a"},
    {"device_id":"player-a","active_match":active_match()},
    {"device_id":"player-a","last_match_lifecycle":{"match_id":"match-a","status":"expired"}},
    {"device_id":"player-a","last_match_result":{"match_id":"match-a","response":official()}},
    {"device_id":"player-a","last_match_lifecycle":{"match_id":"match-a","status":"expired","receipt":{}}},
])
def test_legacy_missing_or_active_is_unresolved(p):assert lookup(p)["status"]=="UNRESOLVED"

@pytest.mark.parametrize("field,value",[("schema_version",True),("player_id","other"),("contest_id",None),("settlement_final",False),("rewards_granted",False)])
def test_malformed_evidence(field,value):
    p=settled_player();p["last_match_result"]["receipt"][field]=value
    assert lookup(p)["status"]=="UNRESOLVED"

def test_missing_response_and_contradictory_evidence():
    p=settled_player();p["last_match_result"].pop("response")
    p["last_match_lifecycle"]={"match_id":"match-a","status":"rejected","receipt":evidence(outcome="rejected")}
    assert lookup(p)["status"]=="UNRESOLVED"

@pytest.mark.parametrize("outcome",["rejected","expired"])
def test_failed_atomic_transition_preserves_active_and_no_partial_evidence(outcome):
    db=AtomicPlayers(dict(device_id="player-a",coins=100,active_match=active_match()));db.fail=True;before=deepcopy(db.player)
    with patch.object(database,"_players",return_value=db),pytest.raises(RuntimeError):
        database.transition_player_match("player-a","match-a",outcome,NOW.isoformat())
    assert db.player==before

def test_old_submission_cannot_expire_other_active_match():
    p=dict(device_id="player-a",active_match=active_match(age_seconds=1000,match_id="newer"))
    with patch.object(service,"find_internal_player",return_value=p),patch.object(service,"expire_stale_match") as expire,pytest.raises(service.MatchValidationError):
        service.submit_result(result())
    expire.assert_not_called()

def test_expiry_rechecks_identity_after_initial_read():
    p=dict(device_id="player-a",active_match=active_match(age_seconds=1000,match_id="newer"))
    with patch.object(service,"find_internal_player",return_value=p),patch.object(service,"transition_player_match") as transition:
        assert not service.expire_stale_match("player-a",NOW,expected_match_id="match-a")
    transition.assert_not_called()

def test_rejection_loses_to_settlement_returns_original_once():
    p=dict(device_id="player-a",active_match=active_match(age_seconds=60));settled=settled_player()
    with patch.object(service,"find_internal_player",side_effect=[p,p,settled]),patch.object(service,"expire_stale_match",return_value=False),patch.object(service,"transition_player_match",return_value=None),patch.object(service,"settle_player_match") as reward,patch.object(service,"_utc_now",return_value=NOW):
        response=service.submit_result(result())
    assert response=={**official(),"already_finalized":True};reward.assert_not_called()

def test_rejection_loses_without_proof_remains_unresolved():
    p=dict(device_id="player-a",active_match=active_match(age_seconds=60))
    with patch.object(service,"find_internal_player",return_value=p),patch.object(service,"expire_stale_match",return_value=False),patch.object(service,"transition_player_match",return_value=None),pytest.raises(service.MatchNotFoundError):service.submit_result(result())

def test_settlement_loses_rejection_cannot_credit():
    db=AtomicPlayers(dict(device_id="player-a",coins=100,active_match=active_match()))
    with patch.object(database,"_players",return_value=db):
        database.transition_player_match("player-a","match-a","rejected",NOW.isoformat())
        assert database.settle_player_match("player-a","match-a",[{"$set":{"coins":999}}]) is None
    assert db.player["coins"]==100 and lookup(db.player)["status"]=="TERMINAL_NO_REWARD"

def test_concurrent_terminal_transitions_only_one_wins():
    db=AtomicPlayers(dict(device_id="player-a",coins=100,active_match=active_match()))
    with patch.object(database,"_players",return_value=db),ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda status:database.transition_player_match("player-a","match-a",status,NOW.isoformat()),["expired","rejected"]))
    assert sum(x is not None for x in results)==1 and db.player["coins"]==100

def test_existing_duplicate_submission_returns_settlement_no_write():
    with patch.object(service,"find_internal_player",return_value=settled_player()),patch.object(service,"settle_player_match") as write:
        assert service.submit_result(result())["already_finalized"] is True
    write.assert_not_called()

@pytest.mark.parametrize("authenticated",[False,True])
def test_endpoint_requires_bearer_and_binds_owner(authenticated):
    async def request():
        return await _asgi_request("/api/match/receipt",method="POST",headers={"content-type":"application/json"},body=json.dumps({"match_id":"match-a","contest_id":"nathans"}).encode())
    with patch.object(server,"authenticated_bearer_player",return_value={"device_id":"player-a"}) if authenticated else patch.object(server,"result_receipt"):
        with patch.object(service,"find_internal_player",return_value=settled_player()):status,_,body=asyncio.run(request())
    assert status==(200 if authenticated else 401)
    if authenticated:assert json.loads(body)["status"]=="SETTLED"


def run_settlement(db, fail=False):
    db.fail=fail
    # Replay itself remains covered by existing anti-cheat/parity tests. This
    # fixture isolates persistence while exercising actual reward pipeline code.
    replay={"replayed_score":0,"maximum_combo":0,"antacids_used":0}
    with patch.object(database,"_players",return_value=db),patch.object(service,"find_internal_player",side_effect=lambda _:deepcopy(db.player)),patch.object(service,"expire_stale_match",return_value=False),patch.object(service,"get_contest",return_value={"id":"nathans"}),patch.object(service,"_validate_result",return_value=({"replay":replay},"accepted")),patch.object(service,"_utc_now",return_value=NOW):
        return service.submit_result(result())

def test_future_settlement_atomically_stores_evidence_and_duplicate_does_not_credit():
    db=AtomicPlayers(dict(device_id="player-a",coins=100,xp=0,antacid=3,active_match=active_match(age_seconds=60)))
    first=run_settlement(db)
    assert first["coin_reward"]==10 and db.player["coins"]==110
    assert db.player["last_match_result"]["receipt"]==evidence()
    assert db.player["last_match_lifecycle"]["receipt"]==evidence()
    assert lookup(db.player)["status"]=="SETTLED"
    assert run_settlement(db)["already_finalized"] is True
    assert db.player["coins"]==110 and len(db.calls)==1

def test_failed_settlement_write_commits_neither_rewards_nor_evidence():
    db=AtomicPlayers(dict(device_id="player-a",coins=100,xp=0,antacid=3,active_match=active_match(age_seconds=60)));before=deepcopy(db.player)
    with pytest.raises(RuntimeError):run_settlement(db,True)
    assert db.player==before

def test_settlement_winner_prevents_late_rejection_from_overwriting_receipt():
    db=AtomicPlayers(dict(device_id="player-a",coins=100,xp=0,antacid=3,active_match=active_match(age_seconds=60)))
    run_settlement(db);before=deepcopy(db.player)
    with patch.object(database,"_players",return_value=db):assert database.transition_player_match("player-a","match-a","rejected",NOW.isoformat()) is None
    assert db.player==before and lookup(db.player)["status"]=="SETTLED"

def test_concurrent_result_requests_share_single_reward():
    db=AtomicPlayers(dict(device_id="player-a",coins=100,xp=0,antacid=3,active_match=active_match(age_seconds=60)))
    replay={"replayed_score":0,"maximum_combo":0,"antacids_used":0}
    with patch.object(database,"_players",return_value=db),patch.object(service,"find_internal_player",side_effect=lambda _:deepcopy(db.player)),patch.object(service,"expire_stale_match",return_value=False),patch.object(service,"get_contest",return_value={"id":"nathans"}),patch.object(service,"_validate_result",return_value=({"replay":replay},"accepted")),patch.object(service,"_utc_now",return_value=NOW),ThreadPoolExecutor(max_workers=2) as pool:
        outcomes=list(pool.map(lambda _:service.submit_result(result()),range(2)))
    assert all(x["coin_reward"]==10 for x in outcomes) and db.player["coins"]==110
    assert lookup(db.player)["status"]=="SETTLED"

def test_wrong_contest_submission_never_expires_active_match():
    p=dict(device_id="player-a",active_match=active_match(age_seconds=1000))
    with patch.object(service,"find_internal_player",return_value=p),patch.object(service,"expire_stale_match") as expire,pytest.raises(service.MatchValidationError):service.submit_result(result(contest_id="other"))
    expire.assert_not_called()

def test_atomic_evidence_uses_stored_contest_not_reason_or_request():
    db=AtomicPlayers(dict(device_id="player-a",coins=100,active_match=active_match()))
    with patch.object(database,"_players",return_value=db):database.transition_player_match("player-a","match-a","rejected",NOW.isoformat(),rejection_reason="$coins")
    assert db.player["last_match_lifecycle"]["rejection_reason"]=="$coins"
    assert lookup(db.player)["receipt"]["contest_id"]=="nathans"

@pytest.mark.parametrize("body",[{"match_id":"match-a"},{"match_id":"match-a","contest_id":"nathans","device_id":"other"}])
def test_receipt_request_requires_exact_fields(body):
    from models import MatchReceiptRequest
    with pytest.raises(ValueError):MatchReceiptRequest(**body)


def test_actual_submit_expiry_persists_proof_without_rewards():
    db=AtomicPlayers(dict(device_id="player-a",coins=100,active_match=active_match(age_seconds=1000)))
    with patch.object(database,"_players",return_value=db),patch.object(service,"find_internal_player",side_effect=lambda _:deepcopy(db.player)),patch.object(service,"_utc_now",return_value=NOW),pytest.raises(service.MatchExpiredError):service.submit_result(result())
    assert db.player["coins"]==100 and lookup(db.player)["status"]=="TERMINAL_NO_REWARD"
    assert lookup(db.player)["receipt"]["outcome"]=="expired"

def test_actual_submit_settlement_loses_to_rejection_and_receipt_proves_terminal():
    db=AtomicPlayers(dict(device_id="player-a",coins=100,xp=0,antacid=3,active_match=active_match(age_seconds=60)))
    def rejection_wins(owner,match,pipeline):
        database.transition_player_match(owner,match,"rejected",NOW.isoformat())
        return database.settle_player_match(owner,match,pipeline)
    with patch.object(service,"settle_player_match",side_effect=rejection_wins),pytest.raises(service.MatchNotFoundError):run_settlement(db)
    assert db.player["coins"]==100 and lookup(db.player)["status"]=="TERMINAL_NO_REWARD"

def test_cancellation_storage_contract_unchanged():
    from unittest.mock import Mock
    collection=Mock()
    with patch.object(database,"_players",return_value=collection):database.transition_player_match("player-a","match-a","cancelled",NOW.isoformat())
    update=collection.find_one_and_update.call_args.args[1]
    assert update=={"$set":{"last_match_lifecycle":{"match_id":"match-a","status":"cancelled","ended_at":NOW.isoformat()}},"$unset":{"active_match":""}}


@pytest.mark.parametrize("target",["receipt","response"])
def test_malformed_unhashable_outcome_remains_unresolved(target):
    p=settled_player();p["last_match_result"][target]["outcome" if target=="receipt" else "authoritative_outcome"]=[]
    assert lookup(p)["status"]=="UNRESOLVED"

def test_actual_rejected_submission_stores_no_reward_receipt():
    db=AtomicPlayers(dict(device_id="player-a",coins=100,active_match=active_match(age_seconds=60)))
    with patch.object(database,"_players",return_value=db),patch.object(service,"find_internal_player",side_effect=lambda _:deepcopy(db.player)),patch.object(service,"expire_stale_match",return_value=False),patch.object(service,"_utc_now",return_value=NOW),pytest.raises(service.MatchValidationError):service.submit_result(result())
    assert db.player["coins"]==100 and lookup(db.player)["status"]=="TERMINAL_NO_REWARD"
