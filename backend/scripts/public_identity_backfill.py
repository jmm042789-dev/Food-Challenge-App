"""Read-only by default public identity preflight and explicit safe backfill."""

import argparse
import json
from pathlib import Path
import sys

from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import load_config
from services.public_identity_backfill import audit_and_backfill, safe_report


APPLY_CONFIRMATION = "BACKFILL_PUBLIC_IDENTITIES"


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit public identity readiness without exposing player records.")
    parser.add_argument("--apply", action="store_true", help="Apply bounded identity-only repairs.")
    parser.add_argument("--confirm", default="", help="Required exact confirmation phrase for --apply.")
    parser.add_argument("--batch-size", type=int, default=250)
    args = parser.parse_args()
    if args.apply and args.confirm != APPLY_CONFIRMATION:
        raise SystemExit(f"Refusing writes: --confirm {APPLY_CONFIRMATION} is required")

    config = load_config(require_database=True)
    client = MongoClient(config.mongo_url, serverSelectionTimeoutMS=10_000)
    try:
        client.admin.command("ping")
        report = audit_and_backfill(
            client[config.db_name]["players"],
            apply=args.apply,
            batch_size=args.batch_size,
        )
        print(json.dumps(safe_report(report), sort_keys=True))
        if report.get("apply_blocked_by_conflicts"):
            raise SystemExit(2)
        if args.apply and report.get("conflicts_skipped"):
            raise SystemExit(3)
    finally:
        client.close()


if __name__ == "__main__":
    main()
