"""Repair: create exporter_profiles, add exporter_profile_id, fix place_id index

Revision ID: 20260317_0006
Revises: 20260317_0005
Create Date: 2026-03-17 00:01:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260317_0006"
down_revision: Union[str, None] = "20260317_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "exporter_profiles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=True),
        sa.Column("profile_name", sa.String(length=100), nullable=False),
        sa.Column("company_name", sa.String(length=200), nullable=False),
        sa.Column("company_location", sa.String(length=200), nullable=True),
        sa.Column("year_established", sa.Integer(), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("contact_person_name", sa.String(length=200), nullable=True),
        sa.Column("contact_email", sa.String(length=200), nullable=True),
        sa.Column("product_categories", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("key_products", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("specializations", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "preferred_categories_for_outreach",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("moq", sa.Integer(), nullable=True),
        sa.Column("monthly_capacity", sa.String(length=100), nullable=True),
        sa.Column("sampling_available", sa.Boolean(), nullable=True),
        sa.Column("sampling_turnaround_days", sa.Integer(), nullable=True),
        sa.Column("bulk_lead_time_days", sa.Integer(), nullable=True),
        sa.Column("sample_policy", sa.Text(), nullable=True),
        sa.Column("minimum_order_flexibility_note", sa.Text(), nullable=True),
        sa.Column("certifications", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("export_markets", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("client_types", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("target_buyer_types", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("value_proposition", sa.Text(), nullable=True),
        sa.Column("production_strengths", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("services", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("shipping_terms", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.add_column(
        "search_sessions",
        sa.Column("exporter_profile_id", sa.Integer(), nullable=True),
    )

    # Initial migration created a unique index; 20260412_0001 may not drop it.
    # Drop so 6eceb329c0e6 can recreate as non-unique.
    op.execute("DROP INDEX IF EXISTS ix_search_results_place_id")


def downgrade() -> None:
    op.create_index(
        op.f("ix_search_results_place_id"),
        "search_results",
        ["place_id"],
        unique=True,
    )
    op.drop_column("search_sessions", "exporter_profile_id")
    op.drop_table("exporter_profiles")
