"""Align search_results.risk_flags from JSON to JSONB

Revision ID: 20260317_0005
Revises: 20260317_0004
Create Date: 2026-03-17 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260317_0005"
down_revision: Union[str, None] = "20260317_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "search_results",
        "risk_flags",
        existing_type=sa.JSON(),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=True,
        postgresql_using="risk_flags::jsonb",
    )


def downgrade() -> None:
    op.alter_column(
        "search_results",
        "risk_flags",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=sa.JSON(),
        existing_nullable=True,
        postgresql_using="risk_flags::json",
    )
