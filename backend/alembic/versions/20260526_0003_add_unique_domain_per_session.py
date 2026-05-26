"""add unique domain per session

Revision ID: 20260526_0003
Revises: 20260526_0002
Create Date: 2026-05-26
"""
from alembic import op

revision = "20260526_0003"
down_revision = "20260526_0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_unique_constraint(
        "uq_search_results_search_id_website",
        "search_results",
        ["search_id", "website"],
    )


def downgrade():
    op.drop_constraint(
        "uq_search_results_search_id_website",
        "search_results",
        type_="unique",
    )
