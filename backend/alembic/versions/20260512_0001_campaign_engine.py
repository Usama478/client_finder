"""campaign engine tables

Revision ID: 20260512_0001
Revises: 71b703b41ef6
Create Date: 2026-05-12
"""
from alembic import op
import sqlalchemy as sa

revision = "20260512_0001"
down_revision = "71b703b41ef6"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "campaigns",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("search_intent", sa.Text(), nullable=False),
        sa.Column("context_id", sa.Integer(), nullable=True),
        sa.Column("target_count", sa.Integer(), nullable=False),
        sa.Column("relevance_threshold", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("credit_budget", sa.Integer(), nullable=False),
        sa.Column("discovery_platform", sa.String(), nullable=False, server_default="both"),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("current_pass", sa.Integer(), server_default="0"),
        sa.Column("verified_count", sa.Integer(), server_default="0"),
        sa.Column("credits_used", sa.Integer(), server_default="0"),
        sa.Column("estimated_cost_low", sa.Integer(), nullable=True),
        sa.Column("estimated_cost_high", sa.Integer(), nullable=True),
        sa.Column("total_discovered", sa.Integer(), server_default="0"),
        sa.Column("total_relevance_passed", sa.Integer(), server_default="0"),
        sa.Column("total_verification_passed", sa.Integer(), server_default="0"),
        sa.Column("activity_log", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.add_column("search_results", sa.Column("campaign_id", sa.Integer(), nullable=True))
    op.add_column("search_results", sa.Column("campaign_status", sa.String(), nullable=True))
    op.add_column("search_results", sa.Column("campaign_pass", sa.Integer(), nullable=True, server_default="1"))

def downgrade():
    op.drop_column("search_results", "campaign_pass")
    op.drop_column("search_results", "campaign_status")
    op.drop_column("search_results", "campaign_id")
    op.drop_table("campaigns")
