CREATE TABLE IF NOT EXISTS exporter_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    is_default BOOLEAN DEFAULT FALSE,
    profile_name VARCHAR(100) NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    company_location VARCHAR(200),
    year_established INTEGER,
    website VARCHAR(500),
    contact_person_name VARCHAR(200),
    contact_email VARCHAR(200),
    product_categories JSONB DEFAULT '[]',
    key_products JSONB DEFAULT '[]',
    specializations JSONB DEFAULT '[]',
    preferred_categories_for_outreach JSONB DEFAULT '[]',
    moq INTEGER,
    monthly_capacity VARCHAR(100),
    sampling_available BOOLEAN DEFAULT TRUE,
    sampling_turnaround_days INTEGER,
    bulk_lead_time_days INTEGER,
    sample_policy TEXT,
    minimum_order_flexibility_note TEXT,
    certifications JSONB DEFAULT '[]',
    export_markets JSONB DEFAULT '[]',
    client_types JSONB DEFAULT '[]',
    target_buyer_types JSONB DEFAULT '[]',
    value_proposition TEXT,
    production_strengths JSONB DEFAULT '[]',
    services JSONB DEFAULT '[]',
    shipping_terms JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_drafts (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL
        REFERENCES search_results(result_id),
    exporter_profile_id INTEGER NOT NULL
        REFERENCES exporter_profiles(id),
    sequence_position INTEGER DEFAULT 1,
    subject VARCHAR(500),
    body TEXT,
    strategy JSONB,
    status VARCHAR(50) DEFAULT 'pending_review',
    sendgrid_message_id VARCHAR(200),
    sendgrid_message_id_normalized VARCHAR(200),
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    bounce_reason VARCHAR(500),
    generation_model VARCHAR(100),
    generation_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (business_id, sequence_position, exporter_profile_id)
);

ALTER TABLE search_sessions
    ADD COLUMN IF NOT EXISTS exporter_profile_id INTEGER
    REFERENCES exporter_profiles(id);

CREATE INDEX IF NOT EXISTS idx_email_drafts_business_id
    ON email_drafts(business_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_status
    ON email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_sendgrid
    ON email_drafts(sendgrid_message_id_normalized);
CREATE INDEX IF NOT EXISTS idx_exporter_profiles_user_id
    ON exporter_profiles(user_id);
