# Leash

A spending leash for AI shopping agents. The AI proposes; deterministic code decides.

## Layout

- `backend/` Django + DRF API and the policy engine
- `frontend/` React + TypeScript app

## Setup (backend)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m unittest leash.test_policy -v
```

## Setup (frontend)

```bash
cd frontend
npm install
npm run dev
```
