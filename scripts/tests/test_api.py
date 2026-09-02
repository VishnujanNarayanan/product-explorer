"""HTTP-level tests for the Product Data Explorer API, in pytest + requests.

These complement the Jest suites rather than repeating them. Jest exercises the
application in-process with its modules wired by Nest's testing harness; this talks
to a deployed URL over the network, so it sees what the Jest suites structurally
cannot: CORS headers, the reverse proxy, TLS, and a schema that drifted from the
entities in production.

    pip install -r scripts/requirements.txt
    API_BASE_URL=http://localhost:3001 pytest scripts/tests -v

Every test skips rather than fails when the API is unreachable, so running the
suite without a server up is a no-op instead of a wall of red.
"""
from __future__ import annotations

import os

import pytest
import requests

BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:3001").rstrip("/")
TIMEOUT = 30


@pytest.fixture(scope="session")
def api() -> requests.Session:
    session = requests.Session()
    session.headers["User-Agent"] = "product-explorer-pytest/1.0"
    try:
        session.get(f"{BASE_URL}/api/health", timeout=5)
    except requests.RequestException as exc:
        pytest.skip(f"API not reachable at {BASE_URL} ({type(exc).__name__})")
    return session


def body_of(response: requests.Response):
    """Endpoints return either a bare list/object or {data: ...}; accept both."""
    payload = response.json()
    return payload.get("data", payload) if isinstance(payload, dict) else payload


class TestHealth:
    def test_health_reports_up(self, api):
        r = api.get(f"{BASE_URL}/api/health", timeout=TIMEOUT)
        assert r.status_code == 200
        assert str(body_of(r).get("status", "")).lower() in {"ok", "up", "healthy"}


class TestCatalogue:
    def test_navigation_returns_headings_with_slugs(self, api):
        r = api.get(f"{BASE_URL}/api/navigation", timeout=TIMEOUT)
        assert r.status_code == 200
        headings = body_of(r)
        assert isinstance(headings, list) and headings, "navigation is empty"
        assert all("slug" in h for h in headings)

    def test_products_respects_the_limit(self, api):
        r = api.get(f"{BASE_URL}/api/products", params={"limit": 3}, timeout=TIMEOUT)
        assert r.status_code == 200
        items = body_of(r)
        if isinstance(items, dict):
            items = items.get("items", items.get("products", []))
        assert isinstance(items, list)
        assert len(items) <= 3

    def test_unknown_product_is_404_not_500(self, api):
        r = api.get(f"{BASE_URL}/api/products/definitely-not-a-real-source-id", timeout=TIMEOUT)
        assert r.status_code in (400, 404), f"got {r.status_code}"


class TestValidation:
    """The API stores what a browser posts to it, so its input rules are load-bearing."""

    @pytest.mark.parametrize(
        "params",
        [
            {"limit": 99999},   # above the Max(1000) on the paging DTO
            {"limit": -1},
            {"limit": "banana"},
        ],
    )
    def test_bad_paging_is_rejected(self, api, params):
        r = api.get(f"{BASE_URL}/api/products", params=params, timeout=TIMEOUT)
        assert r.status_code == 400, f"{params} returned {r.status_code}, expected 400"

    def test_import_rejects_an_unvalidated_payload(self, api):
        r = api.post(
            f"{BASE_URL}/api/categories/does-not-matter/import",
            json={"products": [{"title": None}]},
            timeout=TIMEOUT,
        )
        assert r.status_code in (400, 404), f"got {r.status_code}"
