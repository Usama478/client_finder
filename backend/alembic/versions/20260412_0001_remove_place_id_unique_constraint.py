"""remove_place_id_unique_constraint

Revision ID: 20260412_0001
Revises: a5feeed02660
Create Date: 2026-04-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260412_0001'
down_revision: Union[str, None] = 'a5feeed02660'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE table_name='search_results' 
                AND constraint_type='UNIQUE'
                AND constraint_name='search_results_place_id_key'
            ) THEN
                ALTER TABLE search_results DROP CONSTRAINT search_results_place_id_key;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.create_unique_constraint('search_results_place_id_key', 'search_results', ['place_id'])
