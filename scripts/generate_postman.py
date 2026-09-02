#!/usr/bin/env python3
"""Generate a Postman collection from the API's OpenAPI snapshot.

The NestJS app already describes itself through @nestjs/swagger, and
`npm run openapi:export` writes that description to docs/openapi.json. Keeping a
Postman collection in step with it by hand does not survive contact with a changing
API, so this derives one instead.

    python scripts/generate_postman.py               # write docs/postman_collection.json
    python scripts/generate_postman.py --check       # exit 1 if the committed file is stale

--check is what CI runs. It fails when someone adds an endpoint and forgets to
regenerate, which is the only failure mode that matters here: a collection that
silently drifts is worse than no collection, because people trust it.

Standard library only, so it runs on a bare Python with nothing installed.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OPENAPI = ROOT / "docs" / "openapi.json"
COLLECTION = ROOT / "docs" / "postman_collection.json"

# Postman writes path parameters as :name and carries their values in a `variable`
# list; OpenAPI writes them as {name}. Everything else about the path is identical.
PATH_PARAM = re.compile(r"\{([^}]+)\}")

# Sensible defaults so a request is runnable the moment it is imported, rather than
# opening on a 400. These are real slugs and ids from the seeded database.
SAMPLE = {
    "slug": "crime-mystery-thriller",
    "sourceId": "9780241988268",
    "id": "1",
    "type": "category",
    "target": "crime-mystery-thriller",
}


def folder_for(path: str) -> str:
    """Group by the segment after /api, so the collection mirrors the API's shape."""
    parts = [p for p in path.split("/") if p and p != "api"]
    if not parts:
        return "Root"
    head = parts[0]
    return {
        "navigation": "Navigation",
        "categories": "Categories",
        "products": "Products",
        "scrape": "Scraping",
        "jobs": "Scraping",
        "cache": "Operations",
        "cleanup": "Operations",
        "health": "Operations",
    }.get(head, head.title())


def example_for(schema: dict, spec: dict, depth: int = 0) -> object:
    """Build a minimal example body from a JSON schema, following $ref once."""
    if depth > 4 or not isinstance(schema, dict):
        return None
    if "$ref" in schema:
        name = schema["$ref"].rsplit("/", 1)[-1]
        target = spec.get("components", {}).get("schemas", {}).get(name, {})
        return example_for(target, spec, depth + 1)
    if "example" in schema:
        return schema["example"]
    t = schema.get("type")
    if t == "object" or "properties" in schema:
        return {
            k: example_for(v, spec, depth + 1)
            for k, v in (schema.get("properties") or {}).items()
        }
    if t == "array":
        return [example_for(schema.get("items") or {}, spec, depth + 1)]
    return {"string": "", "integer": 0, "number": 0, "boolean": False}.get(t)


def build_request(method: str, path: str, op: dict, spec: dict) -> dict:
    postman_path = PATH_PARAM.sub(lambda m: ":" + m.group(1), path)
    segments = [s for s in postman_path.split("/") if s]

    query, variables = [], []
    for param in op.get("parameters") or []:
        loc, name = param.get("in"), param.get("name")
        if loc == "query":
            query.append(
                {
                    "key": name,
                    "value": "",
                    # Optional query parameters ship disabled, so importing the
                    # collection does not send empty filters on every call.
                    "disabled": not param.get("required", False),
                    "description": (param.get("description") or "").strip(),
                }
            )
        elif loc == "path":
            variables.append({"key": name, "value": SAMPLE.get(name, "")})

    item = {
        "name": op.get("summary") or f"{method.upper()} {path}",
        "request": {
            "method": method.upper(),
            "header": [],
            "url": {
                "raw": "{{baseUrl}}" + postman_path,
                "host": ["{{baseUrl}}"],
                "path": segments,
            },
            "description": (op.get("description") or "").strip(),
        },
    }
    if query:
        item["request"]["url"]["query"] = query
    if variables:
        item["request"]["url"]["variable"] = variables

    body_schema = (
        (op.get("requestBody") or {})
        .get("content", {})
        .get("application/json", {})
        .get("schema")
    )
    if body_schema:
        item["request"]["header"].append(
            {"key": "Content-Type", "value": "application/json"}
        )
        item["request"]["body"] = {
            "mode": "raw",
            "raw": json.dumps(example_for(body_schema, spec) or {}, indent=2),
            "options": {"raw": {"language": "json"}},
        }

    # One assertion per request, so `newman run` is a real check rather than a
    # sequence of calls nobody reads the output of.
    item["event"] = [
        {
            "listen": "test",
            "script": {
                "type": "text/javascript",
                "exec": [
                    "pm.test('status is 2xx', function () {",
                    "    pm.expect(pm.response.code).to.be.within(200, 299);",
                    "});",
                    "pm.test('responds under 10s', function () {",
                    "    pm.expect(pm.response.responseTime).to.be.below(10000);",
                    "});",
                ],
            },
        }
    ]
    return item


def build(spec: dict) -> dict:
    info = spec.get("info", {})
    folders: dict[str, list] = {}
    for path, ops in sorted((spec.get("paths") or {}).items()):
        for method, op in ops.items():
            if method.lower() not in {"get", "post", "put", "patch", "delete"}:
                continue
            folders.setdefault(folder_for(path), []).append(
                build_request(method, path, op, spec)
            )

    return {
        "info": {
            "name": info.get("title", "API"),
            "description": (
                "Generated from docs/openapi.json by scripts/generate_postman.py. "
                "Do not edit by hand — regenerate instead.\n\n"
                "Run the whole collection from the command line with:\n"
                "    newman run docs/postman_collection.json --env-var baseUrl=http://localhost:3001"
            ),
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "item": [
            {"name": name, "item": items} for name, items in sorted(folders.items())
        ],
        "variable": [
            {"key": "baseUrl", "value": "http://localhost:3001", "type": "string"}
        ],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--check",
        action="store_true",
        help="verify the committed collection matches the current OpenAPI snapshot",
    )
    args = ap.parse_args()

    if not OPENAPI.exists():
        print(f"missing {OPENAPI} — run `npm run openapi:export` in backend/", file=sys.stderr)
        return 2

    spec = json.loads(OPENAPI.read_text(encoding="utf8"))
    generated = json.dumps(build(spec), indent=2, ensure_ascii=False) + "\n"

    if args.check:
        if not COLLECTION.exists():
            print(f"{COLLECTION.name} does not exist — run this script without --check", file=sys.stderr)
            return 1
        if COLLECTION.read_text(encoding="utf8") != generated:
            print(
                f"{COLLECTION.name} is stale. Run: python scripts/generate_postman.py",
                file=sys.stderr,
            )
            return 1
        print(f"{COLLECTION.name} is up to date")
        return 0

    COLLECTION.write_text(generated, encoding="utf8")
    count = sum(len(f["item"]) for f in json.loads(generated)["item"])
    print(f"wrote {COLLECTION.relative_to(ROOT)} — {count} requests")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
