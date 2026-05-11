"""Phase 6 discovery platform selector

Revision ID: 20260427_0004
Revises: 20260427_0003
Create Date: 2026-04-27
"""
from alembic import op
import sqlalchemy as sa

revision = "20260427_0004"
down_revision = "20260427_0003"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("search_sessions", sa.Column("discovery_platform", sa.String(10), nullable=True, server_default="both"))

def downgrade() -> None:
    op.drop_column("search_sessions", "discovery_platform")
