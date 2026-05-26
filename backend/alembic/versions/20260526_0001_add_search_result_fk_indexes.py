"""add indexes to search_results fk columns

Revision ID: 20260526_0001
Revises: 20260523_0001
Create Date: 2026-05-26
"""
from alembic import op

revision = "20260526_0001"
down_revision = "20260523_0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("ix_search_results_user_id", "search_results", ["user_id"])
    op.create_index("ix_search_results_search_id", "search_results", ["search_id"])
    op.create_index("ix_search_results_campaign_id", "search_results", ["campaign_id"])


def downgrade():
    op.drop_index("ix_search_results_campaign_id", table_name="search_results")
    op.drop_index("ix_search_results_search_id", table_name="search_results")
    op.drop_index("ix_search_results_user_id", table_name="search_results")
