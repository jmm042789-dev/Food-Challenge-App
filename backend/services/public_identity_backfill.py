"""Aggregate-only public identity audit and bounded, idempotent repair helpers."""

from collections import Counter
import re
from typing import Any

from services.social_service import (
    generate_default_handle,
    generate_public_id,
    normalize_handle,
    validate_handle,
)


PUBLIC_ID_PATTERN = re.compile(r"^ffp_[A-Za-z0-9_-]{22}$")
IDENTITY_FIELDS = ("public_id", "public_handle", "public_handle_normalized")
REPORT_FIELDS = (
    "total_players_scanned",
    "complete_identity_count",
    "missing_all_identity_count",
    "partial_identity_count",
    "duplicate_public_id_count",
    "duplicate_normalized_handle_count",
    "null_empty_invalid_public_id_count",
    "null_empty_invalid_handle_count",
    "normalized_handle_mismatch_count",
    "players_requiring_backfill",
    "players_requiring_manual_resolution",
    "updates_applied",
    "conflicts_skipped",
)


def valid_public_id(value: Any) -> bool:
    return isinstance(value, str) and bool(PUBLIC_ID_PATTERN.fullmatch(value))


def canonical_handle(value: Any) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return validate_handle(value)
    except Exception:
        return None


def _present(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _desired_handle(document: dict) -> str | None:
    return canonical_handle(document.get("public_handle")) or canonical_handle(
        document.get("public_handle_normalized")
    )


def _identity_projection(document: dict) -> dict:
    return {"_id": document.get("_id"), **{field: document.get(field) for field in IDENTITY_FIELDS}}


def _projected_players(collection, batch_size: int) -> list[dict]:
    cursor = collection.find({}, {"_id": 1, **{field: 1 for field in IDENTITY_FIELDS}})
    if hasattr(cursor, "batch_size"):
        cursor = cursor.batch_size(batch_size)
    return [_identity_projection(document) for document in cursor]


def _duplicate_members(values: list[str]) -> set[str]:
    counts = Counter(values)
    return {value for value, count in counts.items() if count > 1}


def _optimistic_identity_query(document: dict) -> dict:
    query: dict[str, Any] = {"_id": document["_id"]}
    clauses = []
    for field in IDENTITY_FIELDS:
        if document.get(field) is None:
            clauses.append({"$or": [{field: {"$exists": False}}, {field: None}]})
        else:
            clauses.append({field: document[field]})
    if clauses:
        query["$and"] = clauses
    return query


def _new_unique(factory, used: set[str], validator) -> str:
    for _ in range(128):
        value = factory()
        if validator(value) and value not in used:
            used.add(value)
            return value
    raise RuntimeError("public identity generation exhausted")


def audit_and_backfill(collection, *, apply: bool = False, batch_size: int = 250) -> dict[str, int | bool]:
    """Audit identities and optionally repair non-conflicting incomplete records.

    Only the three public identity fields are projected or updated. When any
    duplicate or invalid non-empty value exists, apply mode is blocked before
    the first write so an operator can review the aggregate preflight safely.
    """
    if not 1 <= batch_size <= 1_000:
        raise ValueError("batch_size must be between 1 and 1000")

    players = _projected_players(collection, batch_size)
    public_values = [str(item["public_id"]) for item in players if _present(item.get("public_id"))]
    handle_values = [value for item in players if (value := _desired_handle(item))]
    duplicate_public_ids = _duplicate_members(public_values)
    duplicate_handles = _duplicate_members(handle_values)

    report = {field: 0 for field in REPORT_FIELDS}
    report["total_players_scanned"] = len(players)
    classifications: list[tuple[dict, str | None, bool]] = []

    for document in players:
        public_id = document.get("public_id")
        handle = document.get("public_handle")
        normalized = document.get("public_handle_normalized")
        desired_handle = _desired_handle(document)
        missing_all = not any(_present(document.get(field)) for field in IDENTITY_FIELDS)
        public_valid = valid_public_id(public_id)
        handle_valid = desired_handle is not None
        normalized_matches = bool(
            desired_handle
            and isinstance(handle, str)
            and isinstance(normalized, str)
            and handle == desired_handle
            and normalized == desired_handle
        )
        duplicate = (
            (_present(public_id) and str(public_id) in duplicate_public_ids)
            or (desired_handle is not None and desired_handle in duplicate_handles)
        )
        complete = public_valid and handle_valid and normalized_matches and not duplicate

        if complete:
            report["complete_identity_count"] += 1
        elif missing_all:
            report["missing_all_identity_count"] += 1
        else:
            report["partial_identity_count"] += 1
        if not public_valid:
            report["null_empty_invalid_public_id_count"] += 1
        if not normalized_matches:
            report["null_empty_invalid_handle_count"] += 1
        if handle_valid and not normalized_matches:
            report["normalized_handle_mismatch_count"] += 1
        if not complete:
            report["players_requiring_backfill"] += 1

        invalid_nonempty_public = _present(public_id) and not public_valid
        invalid_nonempty_handle = (
            (_present(handle) and canonical_handle(handle) is None)
            or (_present(normalized) and canonical_handle(normalized) is None)
        )
        manual = invalid_nonempty_public or invalid_nonempty_handle or duplicate
        if manual:
            report["players_requiring_manual_resolution"] += 1
        classifications.append((document, desired_handle, manual))

    report["duplicate_public_id_count"] = sum(
        1 for item in players if _present(item.get("public_id")) and str(item["public_id"]) in duplicate_public_ids
    )
    report["duplicate_normalized_handle_count"] = sum(
        1 for item in players if (value := _desired_handle(item)) is not None and value in duplicate_handles
    )
    report["apply_requested"] = apply
    report["apply_blocked_by_conflicts"] = bool(apply and report["players_requiring_manual_resolution"])

    if not apply:
        return report
    if report["players_requiring_manual_resolution"]:
        report["conflicts_skipped"] = report["players_requiring_manual_resolution"]
        return report

    used_public_ids = set(public_values)
    used_handles = set(handle_values)
    for document, desired_handle, _manual in classifications:
        public_id = document.get("public_id")
        handle = desired_handle
        if valid_public_id(public_id) and handle is not None and document.get("public_handle") == handle and document.get("public_handle_normalized") == handle:
            continue
        if not valid_public_id(public_id):
            public_id = _new_unique(generate_public_id, used_public_ids, valid_public_id)
        if handle is None:
            handle = _new_unique(generate_default_handle, used_handles, lambda value: canonical_handle(value) == value)
        update = {"public_id": public_id, "public_handle": handle, "public_handle_normalized": normalize_handle(handle)}
        result = collection.update_one(_optimistic_identity_query(document), {"$set": update}, upsert=False)
        if getattr(result, "matched_count", 0) == 1:
            report["updates_applied"] += 1
        else:
            report["conflicts_skipped"] += 1
    return report


def safe_report(report: dict[str, Any]) -> dict[str, int | bool]:
    """Return the fixed aggregate allowlist used by CLI output and logs."""
    return {
        field: value
        for field in (*REPORT_FIELDS, "apply_requested", "apply_blocked_by_conflicts")
        if isinstance((value := report.get(field)), (int, bool))
    }
