"""Phase 3 enrichment schema changes

Revision ID: 20260427_0002
Revises: 71b703b41ef6
Create Date: 2026-04-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260427_0002"
down_revision = "71b703b41ef6"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("search_results", sa.Column("serp_enrichment", postgresql.JSONB(), nullable=True))
    op.add_column("search_results", sa.Column("linkedin_url", sa.String(), nullable=True))
    op.add_column("search_results", sa.Column("verified_product_catalog", postgresql.JSONB(), nullable=True))

def downgrade() -> None:
    op.drop_column("search_results", "verified_product_catalog")
    op.drop_column("search_results", "linkedin_url")
    op.drop_column("search_results", "serp_enrichment")
