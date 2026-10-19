# Leash backend (starter)

A spending leash for AI shopping agents. The LLM proposes; deterministic Django code decides.

## Status

| Piece                                            | State                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `leash/policy.py` rules + signing                | Done, 16 passing tests                                                                                       |
| `leash/models.py`, `views.py`, `urls.py`         | Written, syntax-checked, **not yet run** (needs Django + DRF installed)                                      |
| `leash/paypal.py`                                | Written from memory of Orders v2, **not yet run against the sandbox**; verify field names in the PayPal docs |
| LLM mandate parser, agent loop, Channel3 adapter | Next (see below)                                                                                             |

## Run the policy tests (no Django needed)

```bash
cd leash_backend
python -m unittest leash.test_policy -v
```

Requires Python 3.10+.

## Wire it into a Django project

```bash
pip install django djangorestframework requests django-cors-headers gunicorn
django-admin startproject config .
python manage.py startapp leash
```

In `config/settings.py`:

```python
INSTALLED_APPS += ["rest_framework", "corsheaders", "leash"]
PAYPAL_CLIENT_ID = os.environ["PAYPAL_CLIENT_ID"]
PAYPAL_CLIENT_SECRET = os.environ["PAYPAL_CLIENT_SECRET"]
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
```

In `config/urls.py`: `path("api/", include("leash.urls"))`. Then `makemigrations leash && migrate`.

## Flow

```
user text ──LLM──▶ structured terms ──▶ POST /mandates/ (signed)
agent ──proposal──▶ POST /mandates/<id>/propose/
                       │ verify signature
                       │ evaluate()  ← deterministic, no LLM
                       ├─ block    → audit row with every rule that fired
                       ├─ escalate → audit row, human clicks in AG Grid → /audit/<id>/resolve/
                       └─ approve  → PayPal order → buyer approves on PayPal → /orders/<id>/capture/
```

## Next steps, in order

1. Create the PayPal sandbox app, add credentials, hit `create_order` once from a Django shell.
2. `agent.py`: one LLM call that turns the user's text into `Mandate` terms (JSON mode, validate with `Mandate.from_dict`).
3. `agent.py`: shopping loop with tools `search_products`, `propose_checkout`. Wrap Channel3 behind one function so you can fall back to a seeded catalog.
4. When the loop reads fetched page text, tag any resulting action `origin="untrusted_content"`. Use `demo_fixtures.py` for the attack scene.
5. React: mandate composer, live activity feed, AG Grid bound to `GET /mandates/<id>/audit/` with Approve/Deny buttons on rows where `resolution == "open"`.
6. Deploy to Render (web service + Postgres) before building anything else on top.

## Known gaps (fine for a hackathon, say so in the writeup)

- No auth: one demo user. Add DRF auth before any real use.
- `spent_cents` counts created orders, so an abandoned approval still holds budget until marked failed.
- Mandate signing uses Django's `SECRET_KEY`; use a dedicated key in production.
