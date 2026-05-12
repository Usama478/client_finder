"""merge_campaign_with_main

Revision ID: 7796587f20d8
Revises: 20260427_0004, 20260512_0001
Create Date: 2026-05-11 07:30:07.276017

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7796587f20d8'
down_revision: Union[str, None] = ('20260427_0004', '20260512_0001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
