# CLAUDE.md — client_finder Project Brain

Read this file before touching any code. It contains everything you need to
avoid duplicating work, breaking existing patterns, or making changes that
contradict past decisions.

---

## What This Project Is

client_finder is a B2B lead discovery SaaS. The target user is an exporter
(e.g. a Pakistani textile manufacturer) who wants to find overseas buyers and
retailers to prospect. The user runs campaigns, the system finds and qualifies
businesses automatically, and the user emails verified leads directly from the app.

---

## The Full Pipeline

User creates campaign
  → sets target count, relevance threshold, credit budget
  → system generates search queries via LLM

Discovery
  → Google Maps API (source="maps")
  → ValueSERP API (source="serp")
  → results deduplicated by domain
  → SearchResult records created

Relevance Agent (LangGraph, 10 nodes)
  → Playwright scrapes homepage + subpages
  → ScraperAPI proxy used on blocked sites
  → catalog_intelligence.py + business_model_intelligence.py + judge.py
  → outputs: relevance_decision, relevance_score, relevance_reason
  → three outcomes: relevant / irrelevant / low_confidence

SERP Enrichment (runs after relevance passes)
  → 3 ValueSERP queries: LinkedIn, company info, product info
  → outputs: serp_enrichment (JSONB), linkedin_url

Verification Agent (LangGraph, 11 nodes)
  → input_preparation → gatekeeper → site_collector → identity_resolver
    → contact_extractor → legitimacy_analyzer → product_catalog_extractor
    → size_estimator → llm_analyst → final_contract_builder → metric_analyst
  → outputs: verification_score, legitimacy_score, verified_product_catalog

Email Outreach
  → Hunter.io finds contact emails
  → SendGrid sends emails, reply goes to user's own email
  → follow-up scheduler exists

---

## Tech Stack

Backend:        FastAPI + PostgreSQL + Docker
Migrations:     Alembic
Agent system:   LangGraph
Scraping:       Playwright + ScraperAPI proxy fallback
LLM:            GPT-4o-mini via LangChain ChatOpenAI(model="gpt-4o-mini", temperature=0)
Frontend:       React + Vite + TypeScript + Tailwind
UI components:  shadcn/ui (in /components/ui)
Auth:           JWT
Email:          SendGrid
APIs:           Google Maps API, ValueSERP API, Hunter.io API, OpenAI API

---

## Project Structure

backend/app/agents/relevancy/     — relevance agent (entry: service_v2.py)
backend/app/agents/verification/  — verification agent (entry: service.py)
backend/app/agents/email_outreach/ — email agent (entry: email_draft_service.py)
backend/app/api/                  — FastAPI route handlers (thin, no business logic)
backend/app/api/routes/           — campaign routes live here
backend/app/services/             — business logic and orchestration
backend/app/models/               — SQLAlchemy models
backend/app/db/                   — session and base
backend/alembic/versions/         — migration files, never edit manually
front_end/src/app/pages/app/      — main app pages
front_end/src/app/pages/auth/     — auth pages
front_end/src/lib/api.ts          — all backend API calls (non-campaign)
front_end/src/lib/campaigns-api.ts — campaign-specific API calls
front_end/src/app/layouts/        — AppLayout wraps all authenticated pages

---

## Architecture Rules — Never Violate These

1. Routes stay thin. No business logic in route handlers. Routes call services,
   services call agents/tools, agents write to DB.

2. Every agent that writes fields to SearchResult must wipe those fields before
   rerun. Stale agent output in the DB causes silent data corruption.

3. The campaign engine (campaign_engine_service.py) runs as a BackgroundTask.
   It must use its own DB session — not the request session. Always create a
   fresh SessionLocal() inside the engine function.

4. verification_score and legitimacy_score are SEPARATE intentional fields.
   Do not merge them. verification_score is the campaign engine's gate.
   legitimacy_score is the deterministic 11-point score from the verification agent.

5. Never call agents directly from route handlers. Always go through the service layer.

6. Never modify Alembic migration files that have already been applied.
   Always create a new migration for schema changes.

7. The frontend derives user_id from the JWT token only. Never trust user_id
   from request bodies — always use current_user.id from the auth dependency.

8. Credit deduction happens via credit_service.py only. Never deduct credits
   by directly modifying the UserCredit model anywhere else.

9. Route handlers that perform synchronous database queries or operations must be
   defined as standard `def` (not `async def`) so FastAPI automatically runs them
   on a worker threadpool, preventing main event loop blockage.

10. Campaign resumption endpoints must obtain a row-level lock (`with_for_update()`)
    on the target `Campaign` row before checking status or launching background
    tasks to prevent duplicate background workers from running concurrently on the
    same campaign.

11. State variables (like agent processing phases) must be persisted in database
    columns or Redis rather than in-memory module-level global variables to ensure
    horizontal scalability.

---

## Database Fields

### SearchResult Model Fields
- **Core Info**: `result_id` (PK), `place_id`, `source` (default "maps"), `user_id` (FK), `search_id` (FK), `raw_data` (JSON), `business_name`, `address`, `website`, `phone_number`, `is_saved_client`.
- **Scraping Memory**: `scraping_status`, `scraped_text_content`.
- **Relevance Agent**: `relevance_status`, `relevance_decision`, `relevance_score`, `relevance_reason`, `confidence`, `match_reasons`, `mismatch_reasons`, `signals_used`, `business_type`, `primary_niche`, `relevancy_artifacts`.
- **Verification Agent**: `verification_status`, `verification_result`, `verification_reason`, `verification_score`, `verification_confidence`, `risk_flags`, `manual_review`, `verification_artifacts`.
- **Enrichment**: `serp_enrichment`, `linkedin_url`, `verified_product_catalog`.
- **Hunter.io**: `hunter_emails`, `primary_contact_email`.
- **Identity (Verification)**: `company_name_confirmed`, `domain_match_confidence`, `country_confirmed`.
- **Contact (Verification)**: `contactability_score`, `email_type`, `all_emails_found`, `all_phones_found`, `whatsapp_number`, `linkedin_company_url`, `social_links`, `contact_form_present`.
- **Collection (Verification)**: `wholesale_page_found`, `wholesale_page_url`.
- **Legitimacy (Verification)**: `has_about_page`, `has_contact_page`, `has_policy_pages`, `legitimacy_score`, `domain_age_years`.
- **Size (Verification)**: `employee_range`, `revenue_band`.
- **Email Context**: `email_context`.
- **Email Agent**: `email_status`, `email_found`, `email_score`, `outreach_status`, `email_subject`, `email_body`.
- **Campaign**: `campaign_id`, `campaign_status`, `campaign_pass`.
- **Timestamps**: `processed_at`, `created_at`.

### SearchSession Model Fields
- **Core**: `search_id` (PK), `user_id` (FK), `search_query`, `search_location`, `search_filters`, `context_id` (FK), `exporter_profile_id` (FK).
- **API State**: `google_api_request_hash`, `next_page_token`, `result_count`.
- **Discovery**: `ai_context`, `approved_queries`, `discovery_platform`.
- **Timestamps**: `created_at`.

### Campaign Model Fields
- **Core Info**: `id` (PK), `user_id` (FK), `search_intent`, `context_id` (FK), `target_count`, `relevance_threshold` (default 60), `credit_budget`, `discovery_platform` (default "both").
- **Runtime Stats**: `status` (pending/running/paused/completed/exhausted/failed), `current_pass`, `verified_count`, `credits_used`, `estimated_cost_low`, `estimated_cost_high`.
- **Results Count**: `total_discovered`, `total_relevance_passed`, `total_verification_passed`.
- **Log / Error**: `activity_log` (Text/JSON), `error_message`.
- **Timestamps**: `started_at`, `completed_at`, `created_at`, `updated_at`.

### ExporterProfile Model Fields
- **Core Info**: `id` (PK), `user_id` (FK), `is_default`, `profile_name`, `company_name`, `company_location`, `year_established`, `website`, `contact_person_name`, `contact_email`.
- **Lists / JSONB**: `product_categories`, `key_products`, `specializations`, `preferred_categories_for_outreach`, `certifications`, `export_markets`, `client_types`, `target_buyer_types`, `production_strengths`, `services`, `shipping_terms`.
- **MOQ / Logistics**: `moq`, `monthly_capacity`, `sampling_available`, `sampling_turnaround_days`, `bulk_lead_time_days`, `sample_policy`, `minimum_order_flexibility_note`.
- **Timestamps**: `created_at`, `updated_at`.

### EmailDraft Model Fields
- **Keys**: `id` (PK), `business_id` (FK), `exporter_profile_id` (FK), `sequence_position` (default 1).
- **Content**: `subject`, `body`, `strategy` (JSONB).
- **Status & Outreach**: `status` (pending_review/approved/sent/bounced/failed/replied), `sendgrid_message_id`, `sendgrid_message_id_normalized`.
- **Analytics**: `sent_at`, `opened_at`, `clicked_at`, `bounced_at`, `bounce_reason`.
- **Model details**: `generation_model`, `generation_error`.
- **Timestamps**: `created_at`, `updated_at`.

### User Model Fields
- **Core**: `user_id` (PK), `name`, `email`, `password_hash`.
- **Flags**: `is_admin`, `is_verified`, `is_active`.
- **Auth state**: `last_login`, `verification_token`, `verification_token_expires`.
- **Timestamps**: `created_at`, `updated_at`.

### SearchContext Model Fields
- **Fields**: `id` (PK), `user_id` (FK), `name`, `prompt_text`.

### UserCredit Model Fields
- **Fields**: `user_id` (PK/FK), `credits_remaining`, `credits_used_total`, `allocated_total`, `last_updated`.

---

## All Services

- **activity_service.py**: Logs user activity.
- **campaign_engine_service.py**: The orchestrator for campaigns; runs iterations over pending SearchResults, pushing them through relevancy, enrichment, and verification.
- **credit_service.py**: Centralized handling of credit deduction and balance checking.
- **email_service.py**: Handles SendGrid email sending logic.
- **google_maps_service.py**: Interacts with Google Maps API for discovery.
- **hunter_service.py**: Interacts with Hunter.io API to find contact emails.
- **query_generator_service.py**: Uses LLM to generate discovery queries based on user intent.
- **serp_discovery_service.py**: Uses ValueSERP API for alternate discovery.
- **serp_enrichment_service.py**: Enriches SearchResults with additional SERP context (LinkedIn, company info).

---

## Credit Costs Per Operation

relevance_agent:    2 credits
verification_agent: 5 credits
serp_enrichment:    1 credit
hunter_email:       3 credits
discovery_pass:     3 credits (flat per pass)

---

## Campaign Status Values

Campaign:        pending → running → completed / exhausted / failed / paused
SearchResult:    pending_relevance → running_relevance → rejected_relevance
                 → queued_for_verification → running_verification
                 → rejected_verification → verified

---

## Discovery Platform Options

"maps"  — Google Maps API only
"serp"  — ValueSERP only
"both"  — both run, deduplicated by domain

---

## Dev Commands

docker compose up --build      — full rebuild
docker compose up              — start without rebuild (backend hot-reloads)
alembic upgrade head           — apply migrations
pytest backend/app/tests/      — run tests
pytest backend/tests/          — run verification tests

---

## Current Status

COMPLETED:
- Auth system (JWT, signup, login, email verification)
- Search session creation and query generation
- Discovery via Google Maps + ValueSERP
- Relevance agent v2 (full LangGraph pipeline)
- Verification agent v2 (11-node LangGraph pipeline)
- SERP enrichment service
- Hunter.io email finding
- Email outreach agent + SendGrid
- Campaign engine (automated loop with credit metering)
- Campaign resume logic
- Frontend: all main pages built
- Production readiness audit executed, scoring 74/100 initially (Needs Work)
- **Remediation & Bugfixes Applied**:
  - Resolved Alembic schema bootstrap by generating the missing `email_drafts` table migrations.
  - Aligned all manual/standalone endpoints (relevance, single/batch verification, Hunter lookup) to charge correct credit rates, sealing the billing leakage.
  - Offloaded blocking database queries in `async def` route handlers to the threadpool (converted to synchronous `def` definitions).
  - Fixed concurrency race conditions on campaign resume by applying row-level locks (`with_for_update()`).
  - Addressed N+1 database performance queries on search sessions, client lists, and follow-up loops.
  - Replaced mutable, thread-local dictionary caches for relevance/verification phases with database-backed columns, enabling horizontal scaling.
  - Optimized production deployment configurations (Uvicorn workers scaled for multi-core, error output sanitization, runtime engine watchdog limits).
- Frontend UX crashes/loading states (SearchBusinessesPage, AppLayout, BusinessDetailsPage, CampaignEnginePage)
- API missing routes/IDOR audit


