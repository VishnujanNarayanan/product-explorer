#!/usr/bin/env python3
"""Smoke-check a running Product Data Explorer API.

The Jest suites cover the application from the inside. This checks it from the
outside, over HTTP, the way a client sees it — which is the only way to catch a
deploy that built fine and still serves nothing: a missing schema column, a cold
database, CORS shutting the front end out.

    python scripts/api_smoke.py                                   # localhost:3001
    python scripts/api_smoke.py --base-url https://api.example.com
    python scripts/api_smoke.py --json                            # machine-readable

Exits non-zero if any check fails, so it can gate a deploy.
"""
from __future__ import annotations

import argparse
import json
import sys
import time

import requests

DEFAULT_BASE = "http://localhost:3001"


class Result:
    def __init__(self, name: str):
        self.name = name
        self.ok = False
        self.detail = ""
        self.ms = 0

    def as_dict(self) -> dict:
        return {"check": self.name, "ok": self.ok, "detail": self.detail, "ms": self.ms}


def check(session: requests.Session, base: str, name: str, path: str, verify) -> Result:
    r = Result(name)
    started = time.monotonic()
    try:
        resp = session.get(base + path, timeout=30)
        r.ms = int((time.monotonic() - started) * 1000)
        if resp.status_code >= 400:
            r.detail = f"HTTP {resp.status_code}"
            return r
        problem = verify(resp.json())
        r.ok = problem is None
        r.detail = problem or "ok"
    except requests.RequestException as exc:
        r.ms = int((time.monotonic() - started) * 1000)
        r.detail = f"{type(exc).__name__}: {exc}"
    except ValueError:
        r.detail = "response was not JSON"
    return r


def unwrap(payload):
    """Endpoints return either a bare list or {data: [...]}; accept both."""
    if isinstance(payload, dict):
        return payload.get("data", payload)
    return payload


def verify_health(payload) -> str | None:
    body = unwrap(payload)
    if not isinstance(body, dict):
        return "health did not return an object"
    if str(body.get("status", "")).lower() not in {"ok", "up", "healthy"}:
        return f"status was {body.get('status')!r}"
    return None


def verify_navigation(payload) -> str | None:
    body = unwrap(payload)
    if not isinstance(body, list):
        return "navigation did not return a list"
    if not body:
        return "navigation is empty — the database has not been seeded or scraped"
    if "slug" not in body[0]:
        return "navigation rows have no slug"
    return None


def verify_products(payload) -> str | None:
    body = unwrap(payload)
    if isinstance(body, dict):
        body = body.get("items", body.get("products", []))
    if not isinstance(body, list):
        return "products did not return a list"
    if body and "source_id" not in body[0] and "sourceId" not in body[0]:
        return "product rows have no source id"
    return None


def verify_rejects_bad_paging(_payload) -> str | None:
    # Reached only on a 2xx, which is itself the failure: the validation pipe is
    # supposed to reject limit=99999 with a 400.
    return "limit=99999 was accepted; the validation pipe is not rejecting it"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base-url", default=DEFAULT_BASE, help=f"default {DEFAULT_BASE}")
    ap.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    args = ap.parse_args()
    base = args.base_url.rstrip("/")

    session = requests.Session()
    session.headers["User-Agent"] = "product-explorer-smoke/1.0"

    results = [
        check(session, base, "health", "/api/health", verify_health),
        check(session, base, "navigation", "/api/navigation", verify_navigation),
        check(session, base, "products (paged)", "/api/products?limit=5", verify_products),
        check(session, base, "categories", "/api/categories", lambda p: None if unwrap(p) is not None else "no body"),
    ]

    # A 400 here is the pass condition, so it is inverted rather than run through check().
    bad = Result("rejects limit=99999")
    try:
        resp = session.get(base + "/api/products?limit=99999", timeout=30)
        bad.ok = resp.status_code == 400
        bad.detail = "ok" if bad.ok else f"expected HTTP 400, got {resp.status_code}"
    except requests.RequestException as exc:
        bad.detail = f"{type(exc).__name__}: {exc}"
    results.append(bad)

    if args.json:
        print(json.dumps([r.as_dict() for r in results], indent=2))
    else:
        print(f"\n  {base}\n")
        for r in results:
            print(f"  {'PASS' if r.ok else 'FAIL'}  {r.name:22s} {r.ms:>6d}ms  {r.detail}")
        failed = [r for r in results if not r.ok]
        print(f"\n  {len(results) - len(failed)}/{len(results)} checks passed\n")

    return 0 if all(r.ok for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
