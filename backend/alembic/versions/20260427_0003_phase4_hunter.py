"""Phase 4 Hunter.io email lookup schema changes

Revision ID: 20260427_0003
Revises: 20260427_0002
Create Date: 2026-04-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260427_0003"
down_revision = "20260427_0002"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("search_results", sa.Column("hunter_emails", postgresql.JSONB(), nullable=True))
    op.add_column("search_results", sa.Column("primary_contact_email", sa.String(255), nullable=True))

def downgrade() -> None:
    op.drop_column("search_results", "primary_contact_email")
    op.drop_column("search_results", "hunter_emails")
