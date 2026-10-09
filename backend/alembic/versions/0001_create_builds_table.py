"""create builds table

Revision ID: 0001
Revises:
Create Date: 2026-09-25 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "builds",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("attack_bonus", sa.Integer(), nullable=False),
        sa.Column("num_dice", sa.Integer(), nullable=False),
        sa.Column("die_sides", sa.Integer(), nullable=False),
        sa.Column("modifier", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("num_attacks", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("advantage", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("disadvantage", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("crit_range", sa.Integer(), nullable=False, server_default="20"),
        sa.Column("power_attack", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("power_attack_bonus", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("power_attack_penalty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_table("builds")
