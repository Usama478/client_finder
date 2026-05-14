# Architecture Decisions

This document tracks every field, pattern, or design choice that might look like a mistake or an anti-pattern at first glance, but is highly intentional. Do NOT change these without understanding the context.

## 1. `verification_score` vs. `legitimacy_score`
- **What it is**: `SearchResult` has both a `verification_score` and a `legitimacy_score`.
- **Why it is intentional**: They are separate concepts. `verification_score` is an overall binary/gating score used by the Campaign Engine to decide if a lead passes verification and should be presented to the user. `legitimacy_score` is a granular, deterministic 11-point score outputted exclusively by the verification agent's `legitimacy_analyzer` node. Merging them would destroy the agent's specific heuristic tracking.

## 2. Campaign Engine as a `BackgroundTask`
- **What it is**: The Campaign Engine runs as a simple FastAPI `BackgroundTask` rather than using a dedicated task queue like Celery or RabbitMQ.
- **Why it is intentional**: Keeps the deployment architecture simple (only web + db) for the MVP phase. Adding a Redis/Celery stack was deemed too heavy right now. We accept the trade-off of background task fragility on container restart for now.

## 3. Dedicated `SessionLocal` in Background Tasks
- **What it is**: The Campaign Engine creates its own database session inside the function instead of using the dependency injection session from the request.
- **Why it is intentional**: The request session closes the moment the HTTP response is sent. Since the background task continues running after the response, it needs a standalone session to avoid `DetachedInstanceError` and `ResourceClosedError`.

## 4. Wiping Agent Output Fields
- **What it is**: Every agent is required to wipe or reset its specific fields on the `SearchResult` model before running.
- **Why it is intentional**: If an agent fails midway or conditionally skips a node on a rerun, the database might retain stale data from a previous run. This causes silent data corruption. Wiping ensures the DB accurately reflects only the latest run.

## 5. Duplicate Discovery Results (`source="maps"` vs `source="serp"`)
- **What it is**: The discovery pipeline uses two distinct providers (Google Maps, ValueSERP) and stores results with a `source` column.
- **Why it is intentional**: Different providers yield different types of raw data. Maps provides highly accurate local data (phones, physical addresses), while SERP provides broad web presences. We deduplicate by domain later, but preserving the exact source string allows us to debug data quality isolated to the provider.

## 6. Frontend deriving `user_id` strictly from JWT
- **What it is**: The frontend does not send `user_id` in API bodies, and the backend ignores it if sent.
- **Why it is intentional**: Standard security practice to prevent IDOR. The auth dependency `current_user.id` is the absolute source of truth.

## 7. `campaign_pass` field on SearchResult
- **What it is**: An integer field tracking passes/iterations.
- **Why it is intentional**: Allows the campaign engine to resume. If a campaign is paused or crashes, the engine queries the DB for items where `campaign_pass` matches the current iteration, preventing redundant processing of already verified leads.
