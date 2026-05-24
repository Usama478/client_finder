"""add campaign_id to search_sessions

Revision ID: 20260523_0001
Revises: 7796587f20d8
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa

revision = "20260523_0001"
down_revision = "7796587f20d8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "search_sessions",
        sa.Column("campaign_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_search_sessions_campaign_id",
        "search_sessions",
        ["campaign_id"],
    )
    op.create_foreign_key(
        "fk_search_sessions_campaign_id",
        "search_sessions",
        "campaigns",
        ["campaign_id"],
        ["id"],
        ondelete="SET NULL",
    )
    # Backfill: any session whose results are tagged with a campaign_id is
    # itself a campaign-created session. Picks the first non-null campaign_id
    # found on the linked results.
    op.execute(
        """
        UPDATE search_sessions ss
        SET campaign_id = sub.campaign_id
        FROM (
            SELECT DISTINCT ON (sr.search_id)
                   sr.search_id, sr.campaign_id
            FROM search_results sr
            WHERE sr.campaign_id IS NOT NULL
            ORDER BY sr.search_id, sr.campaign_id
        ) AS sub
        WHERE ss.search_id = sub.search_id
          AND ss.campaign_id IS NULL
        """
    )


def downgrade():
    op.drop_constraint(
        "fk_search_sessions_campaign_id", "search_sessions", type_="foreignkey"
    )
    op.drop_index("ix_search_sessions_campaign_id", table_name="search_sessions")
    op.drop_column("search_sessions", "campaign_id")
