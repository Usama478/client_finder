"""Phase 2 schema changes

Revision ID: 20260427_0001
Revises: 20260414_0002
Create Date: 2026-04-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260427_0001"
down_revision = "20260414_0002"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # ALTER TABLE search_results ALTER COLUMN place_id DROP NOT NULL
    op.alter_column("search_results", "place_id", nullable=True, existing_type=sa.String())
    
    # ALTER TABLE search_results ADD COLUMN source VARCHAR NOT NULL DEFAULT 'maps'
    op.add_column("search_results", sa.Column("source", sa.String(), nullable=False, server_default="maps"))
    
    # ALTER TABLE search_sessions ADD COLUMN ai_context VARCHAR
    op.add_column("search_sessions", sa.Column("ai_context", sa.String(), nullable=True))
    
    # ALTER TABLE search_sessions ADD COLUMN approved_queries JSONB
    op.add_column("search_sessions", sa.Column("approved_queries", postgresql.JSONB(), nullable=True))

def downgrade() -> None:
    # ALTER TABLE search_results ALTER COLUMN place_id SET NOT NULL
    op.alter_column("search_results", "place_id", nullable=False, existing_type=sa.String())
    
    # ALTER TABLE search_results DROP COLUMN source
    op.drop_column("search_results", "source")
    
    # ALTER TABLE search_sessions DROP COLUMN ai_context
    op.drop_column("search_sessions", "ai_context")
    
    # ALTER TABLE search_sessions DROP COLUMN approved_queries
    op.drop_column("search_sessions", "approved_queries")
