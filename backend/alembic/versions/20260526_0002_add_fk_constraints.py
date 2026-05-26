"""add FK constraints on campaigns and search_results.campaign_id

Revision ID: 20260526_0002
Revises: 20260526_0001
Create Date: 2026-05-26
"""
from alembic import op

revision = "20260526_0002"
down_revision = "20260526_0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_foreign_key(
        "fk_search_results_campaign_id",
        "search_results", "campaigns",
        ["campaign_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_campaigns_user_id",
        "campaigns", "users",
        ["user_id"], ["user_id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_campaigns_context_id",
        "campaigns", "search_contexts",
        ["context_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint("fk_campaigns_context_id", "campaigns", type_="foreignkey")
    op.drop_constraint("fk_campaigns_user_id", "campaigns", type_="foreignkey")
    op.drop_constraint("fk_search_results_campaign_id", "search_results", type_="foreignkey")
