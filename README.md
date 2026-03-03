# Local Setup Guide

Welcome to the **Client Finder** project! Follow these steps to get the full stack (Frontend, Backend, and Database) running locally on your machine using Docker Compose.

## 1. Environment Variables

Create a `.env` file in the **root directory** (`client_finder_project/`) and add:

```env
MAPS_API_KEY=
OPENAI_API_KEY=
```

`DATABASE_URL` is already set in `docker-compose.yml` for the backend container.

## 2. Start the Application

From the project root:

```bash
docker compose up --build
```

## 3. Database Initialization (Alembic)

Database schema is now managed by Alembic migrations.

Backend startup runs:

```bash
alembic upgrade head
```

before launching Uvicorn. This replaces `Base.metadata.create_all()` and manual one-off migration scripts.

## 4. Accessing the Application

- Frontend: http://localhost:5173
- Backend docs: http://localhost:8000/docs
- Postgres: `localhost:5432`
  - User: `postgres`
  - Password: `postgres`
  - Database: `clientfinder`

## Troubleshooting

- If backend startup fails, verify DB health and that `DATABASE_URL` points to the expected Postgres host/db.
- After dependency updates (`requirements.txt`, `package.json`), rerun with `--build`.
