"""builds: optional once-per-turn extra damage

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-23 00:00:00.000000

Roadmap step 11. A nullable `once_per_turn` JSON column -- existing builds
get NULL (no extra damage), so their numbers don't change. The per-attack
`once_per_turn_eligible` flag lives inside the `attacks` JSON and defaults
to false when absent, so it needs no data migration.

Downgrade drops the column (any saved once-per-turn damage is lost; the
eligible flags stay in the JSON and are ignored by older code).
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("builds", sa.Column("once_per_turn", sa.JSON(), nullable=True))


def downgrade() -> None:
    # batch mode so this also works on SQLite (no DROP COLUMN).
    with op.batch_alter_table("builds") as batch:
        batch.drop_column("once_per_turn")
