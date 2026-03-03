# Backend Setup

## Required environment variables

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clientfinder
MAPS_API_KEY=
OPENAI_API_KEY=
```

## Run locally (non-docker)

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Schema changes must go through Alembic revisions (no manual `ALTER TABLE` scripts).
