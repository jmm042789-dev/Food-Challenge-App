"""Generate and optionally provision 100 one-use codes. Never commit the CSV."""
import argparse, csv, hashlib, secrets, sys
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import load_config
from data.promotions import CRUISE_DUCK_CAMPAIGN, CRUISE_DUCK_CODE_COUNT
from pymongo import MongoClient

def new_code() -> str:
    value = secrets.token_hex(12).upper()
    return "FF-" + "-".join(value[index:index + 4] for index in range(0, len(value), 4))

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--provision", action="store_true")
    args = parser.parse_args(); output = Path(args.output).resolve()
    if output.exists(): raise SystemExit("Refusing to overwrite an existing private manifest")
    records = []
    for number in range(1, CRUISE_DUCK_CODE_COUNT + 1):
        code = new_code(); records.append({"duck_number": f"{number:03d}", "redemption_code": code, "qr_url": f"https://firefeastgame.com/duck?d={number:03d}", "code_hash": hashlib.sha256(code.encode()).hexdigest()})
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=["duck_number", "redemption_code", "qr_url"]); writer.writeheader(); writer.writerows({key: row[key] for key in writer.fieldnames} for row in records)
    if args.provision:
        config = load_config(require_database=True); client = MongoClient(config.mongo_url); collection = client[config.db_name]["promotion_codes"]; now = datetime.now(timezone.utc).isoformat()
        collection.insert_many([{"campaign": CRUISE_DUCK_CAMPAIGN, "duck_number": row["duck_number"], "code_hash": row["code_hash"], "status": "AVAILABLE", "created_at": now} for row in records], ordered=True); client.close()
    print(f"Generated {len(records)} private tag records at {output}")

if __name__ == "__main__": main()
