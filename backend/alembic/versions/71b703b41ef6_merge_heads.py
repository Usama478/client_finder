"""merge_heads

Revision ID: 71b703b41ef6
Revises: 20260427_0001, 6eceb329c0e6
Create Date: 2026-04-27 08:32:31.038682

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '71b703b41ef6'
down_revision: Union[str, None] = ('20260427_0001', '6eceb329c0e6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
