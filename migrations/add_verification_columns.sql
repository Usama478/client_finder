-- Migration: add_verification_columns
-- Adds all Verification Agent output columns to search_results.
-- Safe to run multiple times: each statement uses ADD COLUMN IF NOT EXISTS.
-- Apply with: psql $DATABASE_URL -f migrations/add_verification_columns.sql

-- -------------------------------------------------------------------------
-- Verification agent — structured artifact blob
-- -------------------------------------------------------------------------
ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS verification_artifacts    JSONB;

-- -------------------------------------------------------------------------
-- Verification agent — decision refinements
-- -------------------------------------------------------------------------
ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS verification_confidence   FLOAT;

-- -------------------------------------------------------------------------
-- Verification agent — identity
-- -------------------------------------------------------------------------
ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS company_name_confirmed    VARCHAR(255);

ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS domain_match_confidence   FLOAT;

ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS country_confirmed         VARCHAR(100);

-- -------------------------------------------------------------------------
-- Verification agent — contact
-- -------------------------------------------------------------------------
ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS contactability_score      INTEGER DEFAULT 0;

ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS email_type                VARCHAR(50);

ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS all_emails_found          JSONB DEFAULT '[]'::jsonb;

ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS all_phones_found          JSONB DEFAULT '[]'::jsonb;

ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS whatsapp_number           VARCHAR(50);

ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS linkedin_company_url      VARCHAR(500);

ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS social_links              JSONB DEFAULT '{}'::jsonb;

ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS contact_form_present      BOOLEAN DEFAULT FALSE;

-- -------------------------------------------------------------------------
-- Verification agent — collection
-- -------------------------------------------------------------------------
ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS wholesale_page_found      BOOLEAN DEFAULT FALSE;

ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS wholesale_page_url        VARCHAR(500);

-- -------------------------------------------------------------------------
-- Verification agent — legitimacy
-- -------------------------------------------------------------------------
ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS has_about_page            BOOLEAN DEFAULT FALSE;

ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS has_contact_page          BOOLEAN DEFAULT FALSE;

ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS has_policy_pages          BOOLEAN DEFAULT FALSE;

ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS legitimacy_score          INTEGER DEFAULT 0;

ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS domain_age_years          INTEGER;

-- -------------------------------------------------------------------------
-- Verification agent — size
-- -------------------------------------------------------------------------
ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS employee_range            VARCHAR(20);

ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS revenue_band              VARCHAR(20);

-- -------------------------------------------------------------------------
-- Verification agent — email context (compiled for Email Agent)
-- -------------------------------------------------------------------------
ALTER TABLE search_results
    ADD COLUMN IF NOT EXISTS email_context             JSONB;
