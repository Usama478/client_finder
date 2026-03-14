"""Add relevancy_artifacts column

Revision ID: 20260312_0003
Revises: 20260305_0002
Create Date: 2026-03-12 00:52:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260312_0003"
down_revision: Union[str, None] = "20260305_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "search_results",
        sa.Column("relevancy_artifacts", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("search_results", "relevancy_artifacts")
