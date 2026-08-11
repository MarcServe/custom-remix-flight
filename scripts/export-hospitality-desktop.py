#!/usr/bin/env python3
"""
Export verified hospitality leads into a well-named Desktop folder structure.

Usage:
  python3 scripts/export-hospitality-desktop.py
  python3 scripts/export-hospitality-desktop.py --dest "$HOME/Desktop/Hospitality leads"

Default destinations (all written when writable):
  - data/hospitality-leads/desktop-export/Hospitality leads
  - /opt/cursor/artifacts/Hospitality leads  (cloud agent download)
  - $HOME/Desktop/Hospitality leads         (local machine)
"""

from __future__ import annotations

import argparse
import csv
import json
import os
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "hospitality-leads" / "verified-leads.json"

FIELDS = [
    "propertyName",
    "propertyType",
    "city",
    "country",
    "address",
    "website",
    "sourceUrl",
    "phone",
    "propertyEmail",
    "decisionMakerName",
    "decisionMakerTitle",
    "decisionMakerEmail",
    "salesEmail",
    "reservationsEmail",
    "emailVerified",
    "emailSource",
    "verificationStatus",
    "verificationMethod",
]

EMAIL_FIELDS = [
    "market",
    "propertyName",
    "city",
    "country",
    "contactRole",
    "email",
    "phone",
    "website",
    "sourceUrl",
    "verificationStatus",
]


def market(lead: dict) -> str:
    c = (lead.get("country") or "").lower()
    if "united states" in c or c in ("usa", "us"):
        return "US"
    if "united kingdom" in c or "uk" in c or c == "gb":
        return "UK"
    return "Other"


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fields})


def expand_emails(subset: list[dict]) -> list[dict]:
    rows: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for lead in subset:
        m = market(lead)
        candidates = [
            ("Decision maker", lead.get("decisionMakerEmail")),
            ("Sales", lead.get("salesEmail")),
            ("Property", lead.get("propertyEmail")),
            ("Reservations", lead.get("reservationsEmail")),
        ]
        for role, email in candidates:
            e = (email or "").strip().lower()
            if not e or "@" not in e:
                continue
            key = (e, lead.get("propertyName") or "")
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "market": m,
                    "propertyName": lead.get("propertyName", ""),
                    "city": lead.get("city", ""),
                    "country": lead.get("country", ""),
                    "contactRole": role,
                    "email": e,
                    "phone": lead.get("phone", ""),
                    "website": lead.get("website", ""),
                    "sourceUrl": lead.get("sourceUrl", ""),
                    "verificationStatus": lead.get("verificationStatus", "verified"),
                }
            )
    rows.sort(key=lambda r: (r["market"], r["city"], r["propertyName"], r["contactRole"]))
    return rows


def unique_emails(rows: list[dict]) -> list[dict]:
    role_rank = {"Decision maker": 0, "Sales": 1, "Property": 2, "Reservations": 3}
    best: dict[str, dict] = {}
    for r in rows:
        e = r["email"]
        if e not in best or role_rank.get(r["contactRole"], 9) < role_rank.get(best[e]["contactRole"], 9):
            best[e] = r
    out = list(best.values())
    out.sort(key=lambda r: (r["market"], r["city"], r["propertyName"]))
    return out


def export_to(root: Path, leads: list[dict], today: str) -> None:
    uk = [L for L in leads if market(L) == "UK"]
    us = [L for L in leads if market(L) == "US"]
    all_emails = expand_emails(leads)
    uk_emails = [r for r in all_emails if r["market"] == "UK"]
    us_emails = [r for r in all_emails if r["market"] == "US"]
    uniq_all = unique_emails(all_emails)
    uniq_uk = unique_emails(uk_emails)
    uniq_us = unique_emails(us_emails)

    snap = root / f"export-{today}"
    (snap / "01-by-market").mkdir(parents=True, exist_ok=True)
    (snap / "02-emails-only").mkdir(parents=True, exist_ok=True)
    (snap / "03-unique-emails").mkdir(parents=True, exist_ok=True)

    write_csv(snap / "01-by-market" / f"hospitality-all-properties-{today}.csv", leads, FIELDS)
    write_csv(snap / "01-by-market" / f"hospitality-UK-properties-{today}.csv", uk, FIELDS)
    write_csv(snap / "01-by-market" / f"hospitality-US-properties-{today}.csv", us, FIELDS)

    write_csv(snap / "02-emails-only" / f"hospitality-all-emails-{today}.csv", all_emails, EMAIL_FIELDS)
    write_csv(snap / "02-emails-only" / f"hospitality-UK-emails-{today}.csv", uk_emails, EMAIL_FIELDS)
    write_csv(snap / "02-emails-only" / f"hospitality-US-emails-{today}.csv", us_emails, EMAIL_FIELDS)

    write_csv(snap / "03-unique-emails" / f"hospitality-all-unique-emails-{today}.csv", uniq_all, EMAIL_FIELDS)
    write_csv(snap / "03-unique-emails" / f"hospitality-UK-unique-emails-{today}.csv", uniq_uk, EMAIL_FIELDS)
    write_csv(snap / "03-unique-emails" / f"hospitality-US-unique-emails-{today}.csv", uniq_us, EMAIL_FIELDS)

    latest = {
        "hospitality-all-unique-emails-LATEST.csv": (uniq_all, EMAIL_FIELDS),
        "hospitality-UK-unique-emails-LATEST.csv": (uniq_uk, EMAIL_FIELDS),
        "hospitality-US-unique-emails-LATEST.csv": (uniq_us, EMAIL_FIELDS),
        "hospitality-all-properties-LATEST.csv": (leads, FIELDS),
        "hospitality-UK-properties-LATEST.csv": (uk, FIELDS),
        "hospitality-US-properties-LATEST.csv": (us, FIELDS),
    }
    for name, (rows, fields) in latest.items():
        write_csv(root / name, rows, fields)

    (root / "README.txt").write_text(
        f"""Hospitality leads — desktop export
Generated: {today}

Folder layout
-------------
export-{today}/
  01-by-market/          Full property rows (UK / US / all)
  02-emails-only/        Every published contact email (multiple per property OK)
  03-unique-emails/      One row per email address (best for campaigns / newsletters)

Root *-LATEST.csv files are quick copies of the newest export.

Counts
------
Properties total: {len(leads)}
Properties UK:    {len(uk)}
Properties US:    {len(us)}
Email contacts:   {len(all_emails)} (UK {len(uk_emails)} / US {len(us_emails)})
Unique emails:    {len(uniq_all)} (UK {len(uniq_uk)} / US {len(uniq_us)})

All emails are website-verified (official contact pages). Source URL is included on each row.
""",
        encoding="utf-8",
    )
    print(f"Exported to {root}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dest",
        action="append",
        default=[],
        help="Destination folder (can repeat). Defaults include Desktop when writable.",
    )
    args = parser.parse_args()

    data = json.loads(SRC.read_text(encoding="utf-8"))
    leads = data["leads"]
    today = date.today().isoformat()

    dests = [Path(p) for p in args.dest] if args.dest else []
    if not dests:
        dests = [
            ROOT / "data" / "hospitality-leads" / "desktop-export" / "Hospitality leads",
            Path("/opt/cursor/artifacts/Hospitality leads"),
            Path.home() / "Desktop" / "Hospitality leads",
        ]

    for dest in dests:
        try:
            dest.mkdir(parents=True, exist_ok=True)
            export_to(dest, leads, today)
        except OSError as e:
            print(f"Skip {dest}: {e}")


if __name__ == "__main__":
    main()
