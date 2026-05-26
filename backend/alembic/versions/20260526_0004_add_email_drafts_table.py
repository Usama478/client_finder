"""add email_drafts table

Revision ID: 20260526_0004
Revises: 20260526_0003
Create Date: 2026-05-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260526_0004"
down_revision = "20260526_0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "email_drafts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("exporter_profile_id", sa.Integer(), nullable=False),
        sa.Column("sequence_position", sa.Integer(), nullable=True, server_default="1"),
        sa.Column("subject", sa.String(length=500), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("strategy", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=True,
            server_default="pending_review",
        ),
        sa.Column("sendgrid_message_id", sa.String(length=200), nullable=True),
        sa.Column("sendgrid_message_id_normalized", sa.String(length=200), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("clicked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("bounced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("bounce_reason", sa.String(length=500), nullable=True),
        sa.Column("generation_model", sa.String(length=100), nullable=True),
        sa.Column("generation_error", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["business_id"], ["search_results.result_id"]),
        sa.ForeignKeyConstraint(["exporter_profile_id"], ["exporter_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "business_id",
            "sequence_position",
            "exporter_profile_id",
            name="uq_email_drafts_business_sequence_profile",
        ),
    )
    op.create_index(
        "idx_email_drafts_business_id",
        "email_drafts",
        ["business_id"],
    )
    op.create_index(
        "idx_email_drafts_status",
        "email_drafts",
        ["status"],
    )
    op.create_index(
        "idx_email_drafts_sendgrid",
        "email_drafts",
        ["sendgrid_message_id_normalized"],
    )


def downgrade():
    op.drop_index("idx_email_drafts_sendgrid", table_name="email_drafts")
    op.drop_index("idx_email_drafts_status", table_name="email_drafts")
    op.drop_index("idx_email_drafts_business_id", table_name="email_drafts")
    op.drop_table("email_drafts")
