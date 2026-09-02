# scripts

Python tooling around the running API. The TypeScript suites test the application
from the inside; these three test and document it from the outside.

```bash
pip install -r scripts/requirements.txt
```

| script | what it does |
| --- | --- |
| `generate_postman.py` | Derives `docs/postman_collection.json` from `docs/openapi.json`. `--check` fails if the committed collection has drifted, which is what CI runs. Standard library only. |
| `api_smoke.py` | Checks a deployed API over HTTP — health, navigation, paging, and that bad paging is actually rejected. Exits non-zero, so it can gate a deploy. |
| `tests/test_api.py` | `pytest` + `requests` suite against a running instance. Skips rather than fails when nothing is listening. |

```bash
python scripts/generate_postman.py                       # regenerate the collection
python scripts/api_smoke.py --base-url http://localhost:3001
API_BASE_URL=http://localhost:3001 pytest scripts/tests -v

# and the same collection from the command line, if newman is installed
newman run docs/postman_collection.json --env-var baseUrl=http://localhost:3001
```
