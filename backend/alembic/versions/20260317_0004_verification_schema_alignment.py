"""Align verification persistence columns with SearchResult model

Revision ID: 20260317_0004
Revises: 20260312_0003
Create Date: 2026-03-17 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260317_0004"
down_revision: Union[str, None] = "20260312_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("search_results", sa.Column("verification_confidence", sa.Float(), nullable=True))
    op.add_column("search_results", sa.Column("contactability_score", sa.Integer(), nullable=True))
    op.add_column(
        "search_results",
        sa.Column("verification_artifacts", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("search_results", sa.Column("company_name_confirmed", sa.String(length=255), nullable=True))
    op.add_column("search_results", sa.Column("domain_match_confidence", sa.Float(), nullable=True))
    op.add_column("search_results", sa.Column("country_confirmed", sa.String(length=100), nullable=True))
    op.add_column("search_results", sa.Column("email_type", sa.String(length=50), nullable=True))
    op.add_column(
        "search_results",
        sa.Column("all_emails_found", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "search_results",
        sa.Column("all_phones_found", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("search_results", sa.Column("whatsapp_number", sa.String(length=50), nullable=True))
    op.add_column("search_results", sa.Column("linkedin_company_url", sa.String(length=500), nullable=True))
    op.add_column(
        "search_results",
        sa.Column("social_links", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("search_results", sa.Column("contact_form_present", sa.Boolean(), nullable=True))
    op.add_column("search_results", sa.Column("wholesale_page_found", sa.Boolean(), nullable=True))
    op.add_column("search_results", sa.Column("wholesale_page_url", sa.String(length=500), nullable=True))
    op.add_column("search_results", sa.Column("has_about_page", sa.Boolean(), nullable=True))
    op.add_column("search_results", sa.Column("has_contact_page", sa.Boolean(), nullable=True))
    op.add_column("search_results", sa.Column("has_policy_pages", sa.Boolean(), nullable=True))
    op.add_column("search_results", sa.Column("legitimacy_score", sa.Integer(), nullable=True))
    op.add_column("search_results", sa.Column("domain_age_years", sa.Integer(), nullable=True))
    op.add_column("search_results", sa.Column("employee_range", sa.String(length=20), nullable=True))
    op.add_column("search_results", sa.Column("revenue_band", sa.String(length=20), nullable=True))
    op.add_column(
        "search_results",
        sa.Column("email_context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("search_results", "email_context")
    op.drop_column("search_results", "revenue_band")
    op.drop_column("search_results", "employee_range")
    op.drop_column("search_results", "domain_age_years")
    op.drop_column("search_results", "legitimacy_score")
    op.drop_column("search_results", "has_policy_pages")
    op.drop_column("search_results", "has_contact_page")
    op.drop_column("search_results", "has_about_page")
    op.drop_column("search_results", "wholesale_page_url")
    op.drop_column("search_results", "wholesale_page_found")
    op.drop_column("search_results", "contact_form_present")
    op.drop_column("search_results", "social_links")
    op.drop_column("search_results", "linkedin_company_url")
    op.drop_column("search_results", "whatsapp_number")
    op.drop_column("search_results", "all_phones_found")
    op.drop_column("search_results", "all_emails_found")
    op.drop_column("search_results", "email_type")
    op.drop_column("search_results", "country_confirmed")
    op.drop_column("search_results", "domain_match_confidence")
    op.drop_column("search_results", "company_name_confirmed")
    op.drop_column("search_results", "verification_artifacts")
    op.drop_column("search_results", "contactability_score")
    op.drop_column("search_results", "verification_confidence")
