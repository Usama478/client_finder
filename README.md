# Local Setup Guide

Welcome to the **Client Finder** project! Follow these steps to get the full stack (Frontend, Backend, and Database) running locally on your machine using Docker Compose.

## 1. Environment Variables

Before starting the application, you need to configure your environment variables. 

Create a `.env` file in the **root directory** of the project (`client_finder_project/`) and add the following keys. Please fill in the actual values provided by the team:

```env
# Google Maps API key for location/business searches
MAPS_API_KEY=

# OpenAI API key for LLM-based analysis
OPENAI_API_KEY=
```

*(Note: The database connection URL is already handled automatically by the `docker-compose.yml` file, so you do not need to set it here.)*

## 2. Start the Application

Once your `.env` file is in place, open your terminal in the root directory and run the following command to build the images and start all services:

```bash
docker compose up --build
```

*(Add the `-d` flag at the end if you want to run the containers in detached mode / in the background.)*

## 3. Database Initialization

**Good news! You don't need to run any manual database migration or table creation commands.**

Our backend is configured to automatically create the necessary database tables on startup. If you look closely at the backend logs, you will see it attempts to connect to the database, and once ready, it runs the table creation script automatically (`Base.metadata.create_all()` inside `main.py`).

## 4. Accessing the Application

Once all the containers are up and running, you can access the different parts of the stack using the following URLs:

- **Frontend Application:** [http://localhost:5173](http://localhost:5173)
- **Backend API Docs (Swagger UI):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Database Connection:** `localhost:5432` 
  - **User:** `postgres`
  - **Password:** `postgres`
  - **Database Name:** `clientfinder`

## Troubleshooting

- If the backend crashes initially, wait a few seconds. It has a retry mechanism to wait for the PostgreSQL database container to become fully healthy before connecting.
- If you make changes to the `package.json` or `requirements.txt`, make sure to restart with the `--build` flag to rebuild the Docker images.
