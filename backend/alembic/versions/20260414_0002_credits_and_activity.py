"""Add credits system and activity log

Revision ID: 20260414_0002
Revises: 20260412_0001
Create Date: 2026-04-14
"""
from alembic import op
import sqlalchemy as sa

revision = "20260414_0002"
down_revision = "20260412_0001"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add new columns to users table
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users", sa.Column("last_login", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("verification_token", sa.String(), nullable=True))
    op.add_column("users", sa.Column("verification_token_expires", sa.DateTime(timezone=True), nullable=True))

    # Create user_credits table
    op.create_table(
        "user_credits",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.user_id"), primary_key=True),
        sa.Column("credits_remaining", sa.Integer(), nullable=False, server_default="200"),
        sa.Column("credits_used_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("allocated_total", sa.Integer(), nullable=False, server_default="200"),
        sa.Column("last_updated", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Create credit_transactions table
    op.create_table(
        "credit_transactions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("action_type", sa.String(), nullable=False),
        sa.Column("credits_delta", sa.Integer(), nullable=False),
        sa.Column("credits_after", sa.Integer(), nullable=False),
        sa.Column("reference_id", sa.String(), nullable=True),
        sa.Column("reference_type", sa.String(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("cost_estimate_usd", sa.Float(), nullable=True),
    )

    # Create activity_log table
    op.create_table(
        "activity_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("action_type", sa.String(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("session_id", sa.Integer(), nullable=True),
        sa.Column("business_id", sa.Integer(), nullable=True),
        sa.Column("credits_consumed", sa.Integer(), server_default="0"),
        sa.Column("cost_estimate_usd", sa.Float(), nullable=True),
    )

def downgrade() -> None:
    op.drop_table("activity_log")
    op.drop_table("credit_transactions")
    op.drop_table("user_credits")
    op.drop_column("users", "verification_token_expires")
    op.drop_column("users", "verification_token")
    op.drop_column("users", "last_login")
    op.drop_column("users", "is_active")
    op.drop_column("users", "is_verified")
    op.drop_column("users", "is_admin")
