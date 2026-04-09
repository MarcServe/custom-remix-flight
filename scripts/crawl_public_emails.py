#!/usr/bin/env python3
"""
Fetch public web pages per domain (polite crawl), extract email addresses,
validate syntax, and verify the domain has MX records (can receive mail).

This does NOT:
- Impersonate a human browser (uses HTTP + parsing; optional realistic User-Agent).
- SMTP-verify that a specific mailbox exists (often blocked / abusive at scale).

Usage:
  pip install -r scripts/requirements-crawl.txt
  python scripts/crawl_public_emails.py --input data/cqc-campaign/campaign_import_info_at_domain_inferred.csv --limit 25

Full crawl (hours): omit --limit and run locally overnight; uses --delay between requests.
"""

from __future__ import annotations

import argparse
import csv
import random
import re
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from typing import Iterable

try:
    import dns.resolver  # type: ignore
except ImportError:
    dns = None  # type: ignore

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DEFAULT_UA = (
    "LeadGenie-CampaignTools/1.0 (email discovery; polite crawl; contact via your site owner)"
)
REQUEST_TIMEOUT = 18
MAX_HTML_BYTES = 2_000_000
CONTACT_PATH_HINTS = (
    "/contact",
    "/contact-us",
    "/contactus",
    "/enquiry",
    "/enquiries",
    "/get-in-touch",
)

EMAIL_PATTERN = re.compile(
    r"[a-zA-Z0-9][a-zA-Z0-9._%+\-]{0,64}@[a-zA-Z0-9][a-zA-Z0-9.\-]{0,253}\.[a-zA-Z]{2,}",
    re.I,
)


def syntax_ok(addr: str) -> bool:
    if len(addr) > 254 or ".." in addr:
        return False
    local, _, domain = addr.partition("@")
    if not local or not domain or "." not in domain:
        return False
    if len(local) > 64:
        return False
    dl = domain.lower()
    # Third-party / error-tracking tokens masquerading as emails on pages
    if any(
        x in dl
        for x in (
            "sentry",
            "wixpress.com",
            "google-analytics",
            "googletagmanager",
            "facebook.com",
            "doubleclick",
        )
    ):
        return False
    # Drop obvious image/data junk
    if any(
        x in addr.lower()
        for x in (".png@", ".jpg@", ".gif@", ".webp@", "example.com", "yourdomain.")
    ):
        return False
    return True


def has_mx(domain: str) -> bool:
    """Domain accepts mail (has MX or A fallback per common MTA behaviour)."""
    if dns is not None:
        try:
            answers = dns.resolver.resolve(domain, "MX")
            return len(answers) > 0
        except Exception:
            pass
        try:
            answers = dns.resolver.resolve(domain, "A")
            return len(answers) > 0
        except Exception:
            return False
    # stdlib fallback: get MX via getaddrinfo doesn't work; try connect to port 25 — skip
    try:
        socket.getaddrinfo(domain, None)
    except Exception:
        return False
    return True


class LinkExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hrefs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        for k, v in attrs:
            if k.lower() == "href" and v:
                self.hrefs.append(v)


def fetch(url: str) -> tuple[str | None, str]:
    """Returns (html_or_none, error_message)."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": DEFAULT_UA,
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-GB,en;q=0.9",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            ctype = resp.headers.get("Content-Type", "")
            if "html" not in ctype.lower() and "text" not in ctype.lower():
                return None, f"skip content-type {ctype!r}"
            raw = resp.read(MAX_HTML_BYTES + 1)
            if len(raw) > MAX_HTML_BYTES:
                return None, "page too large"
            return raw.decode("utf-8", errors="replace"), ""
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}"
    except urllib.error.URLError as e:
        return None, f"URL {e.reason!r}"
    except Exception as e:
        return None, str(e)


def extract_emails_from_html(html: str, base_url: str) -> set[str]:
    found: set[str] = set()
    for m in EMAIL_PATTERN.finditer(html):
        addr = m.group(0).lower().strip()
        if syntax_ok(addr):
            found.add(addr)
    # mailto:
    for m in re.finditer(r'mailto:([^"\'>\s]+)', html, re.I):
        part = urllib.parse.unquote(m.group(1).split("?")[0])
        if "@" in part:
            addr = part.lower().strip()
            if syntax_ok(addr):
                found.add(addr)
    return found


def normalize_contact_url(base: str, href: str) -> str | None:
    try:
        return urllib.parse.urljoin(base, href)
    except Exception:
        return None


def pick_contact_urls(base_page_url: str, html: str) -> list[str]:
    parser = LinkExtractor()
    try:
        parser.feed(html)
    except Exception:
        pass
    out: list[str] = []
    seen: set[str] = set()
    for href in parser.hrefs:
        if not href or href.startswith("#") or href.lower().startswith("javascript:"):
            continue
        low = href.lower()
        if any(h in low for h in CONTACT_PATH_HINTS):
            u = normalize_contact_url(base_page_url, href)
            if u and u not in seen:
                seen.add(u)
                out.append(u)
    return out[:3]


def domain_from_row_email(email_col: str) -> str | None:
    email_col = (email_col or "").strip().lower()
    if "@" not in email_col:
        return None
    return email_col.rsplit("@", 1)[-1].strip()


def iter_domains_from_inferred_csv(path: str) -> Iterable[tuple[str, str]]:
    """Yields (company, domain) from campaign_import_info_at_domain_inferred.csv"""
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            company = (row.get("company") or "").strip()
            em = row.get("email") or ""
            dom = domain_from_row_email(em)
            if dom:
                yield company, dom


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract public emails from websites (polite crawl).")
    ap.add_argument(
        "--input",
        default="data/cqc-campaign/campaign_import_info_at_domain_inferred.csv",
        help="CSV with info@domain in email column",
    )
    ap.add_argument("--output", default="data/cqc-campaign/crawled_public_emails.csv")
    ap.add_argument("--limit", type=int, default=0, help="Max domains (0 = no limit)")
    ap.add_argument("--delay", type=float, default=1.8, help="Seconds between requests (jitter added)")
    ap.add_argument("--skip-mx", action="store_true", help="Do not check MX/DNS for domain")
    args = ap.parse_args()

    if dns is None and not args.skip_mx:
        print("Warning: dnspython not installed; pip install dnspython or use --skip-mx", file=sys.stderr)

    rows_out: list[dict[str, str]] = []
    seen_domain: set[str] = set()
    n = 0
    for company, domain in iter_domains_from_inferred_csv(args.input):
        if domain in seen_domain:
            continue
        seen_domain.add(domain)
        if args.limit and n >= args.limit:
            break
        n += 1

        urls_try = [
            f"https://{domain}/",
            f"https://www.{domain}/",
            f"http://{domain}/",
        ]
        collected: set[str] = set()
        pages_hit = 0
        err = ""
        base_used = ""

        for base in urls_try:
            html, err = fetch(base)
            if html:
                base_used = base
                pages_hit += 1
                collected |= extract_emails_from_html(html, base)
                for extra in pick_contact_urls(base, html):
                    h2, e2 = fetch(extra)
                    if h2:
                        pages_hit += 1
                        collected |= extract_emails_from_html(h2, extra)
                    time.sleep(args.delay + random.uniform(0, 0.6))
                break
            time.sleep(0.3)

        if collected:
            for addr in sorted(collected):
                dom = addr.rsplit("@", 1)[-1]
                mx = True if args.skip_mx else has_mx(dom)
                rows_out.append(
                    {
                        "company": company,
                        "domain": domain,
                        "email": addr,
                        "syntax_valid": "yes",
                        "domain_mx_or_dns": "yes" if mx else "no",
                        "verified_mailbox": "not_checked",
                        "source_url": base_used or "",
                        "pages_fetched": str(pages_hit),
                        "fetch_error": "",
                    }
                )
        else:
            rows_out.append(
                {
                    "company": company,
                    "domain": domain,
                    "email": "",
                    "syntax_valid": "",
                    "domain_mx_or_dns": "",
                    "verified_mailbox": "not_checked",
                    "source_url": base_used or "",
                    "pages_fetched": str(pages_hit),
                    "fetch_error": err if not base_used else "no_emails_found_in_html",
                }
            )

        time.sleep(args.delay + random.uniform(0.4, 1.2))

    fieldnames = [
        "company",
        "domain",
        "email",
        "syntax_valid",
        "domain_mx_or_dns",
        "verified_mailbox",
        "source_url",
        "pages_fetched",
        "fetch_error",
    ]
    with open(args.output, "w", newline="", encoding="utf-8") as out:
        w = csv.DictWriter(out, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows_out)

    print(f"Wrote {len(rows_out)} email row(s) from {n} domain(s) to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
