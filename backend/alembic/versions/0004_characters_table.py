"""characters table

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-27 00:00:00.000000

Roadmap step 13: saved character sheets. A new table only -- builds are
untouched. Downgrade drops it (saved characters are lost; restore the
pre-deploy backup if you need them back).
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "characters",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("sheet", sa.JSON(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_table("characters")
