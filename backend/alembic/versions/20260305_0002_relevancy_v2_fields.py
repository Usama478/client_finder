"""Add relevancy v2 persistence fields

Revision ID: 20260305_0002
Revises: 20260303_0001
Create Date: 2026-03-05 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260305_0002"
down_revision: Union[str, None] = "20260303_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("search_results", sa.Column("confidence", sa.Float(), nullable=True))
    op.add_column("search_results", sa.Column("match_reasons", sa.JSON(), nullable=True))
    op.add_column("search_results", sa.Column("mismatch_reasons", sa.JSON(), nullable=True))
    op.add_column("search_results", sa.Column("signals_used", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("search_results", "signals_used")
    op.drop_column("search_results", "mismatch_reasons")
    op.drop_column("search_results", "match_reasons")
    op.drop_column("search_results", "confidence")
