"""one active campaign partial unique index

Revision ID: 20260529_0005
Revises: 20260526_0004
Create Date: 2026-05-29

Adds a PostgreSQL partial unique index on campaigns(user_id) where status is
'pending' or 'running'. This enforces the one-active-campaign-per-user invariant
at the database level, closing the TOCTOU race where two concurrent POST /campaigns
requests could both pass the in-memory check and spawn duplicate workers.
"""
from alembic import op

revision = "20260529_0005"
down_revision = "20260526_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE UNIQUE INDEX uix_one_active_campaign
        ON campaigns(user_id)
        WHERE status IN ('pending', 'running')
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uix_one_active_campaign")
