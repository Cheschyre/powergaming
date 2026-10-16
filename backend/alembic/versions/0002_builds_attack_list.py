"""builds: single attack profile + num_attacks -> list of attack entries

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-09 00:00:00.000000

Roadmap step 9. Each build's one profile, repeated num_attacks times,
becomes an `attacks` JSON list of that many identical entries -- the round's
numbers are unchanged (N identical attacks = the old HAD x N). The old
per-profile columns are dropped.

Downgrade rebuilds the old columns from the FIRST entry, with num_attacks =
the list length. That's exact for builds whose attacks are all identical
(every build that existed before this migration) and lossy for builds
created afterwards with different attacks -- restore the pre-deploy backup
instead if you need those back exactly.
"""

import json

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

# Old per-build columns that move into each attack entry:
# (name, type, server default in 0001, Python default for missing values).
PROFILE_COLUMNS = [
    ("attack_bonus", sa.Integer(), None, None),
    ("num_dice", sa.Integer(), None, None),
    ("die_sides", sa.Integer(), None, None),
    ("modifier", sa.Integer(), "0", 0),
    ("advantage", sa.Boolean(), sa.false(), False),
    ("disadvantage", sa.Boolean(), sa.false(), False),
    ("crit_range", sa.Integer(), "20", 20),
    ("power_attack", sa.Boolean(), sa.false(), False),
    ("power_attack_bonus", sa.Integer(), "0", 0),
    ("power_attack_penalty", sa.Integer(), "0", 0),
]
BOOLEAN_COLUMNS = {name for name, type_, _, _ in PROFILE_COLUMNS if isinstance(type_, sa.Boolean)}


def _builds_table() -> sa.Table:
    return sa.table(
        "builds",
        sa.column("id", sa.Integer()),
        sa.column("attacks", sa.JSON()),
        sa.column("num_attacks", sa.Integer()),
        *(sa.column(name, type_) for name, type_, _, _ in PROFILE_COLUMNS),
    )


def upgrade() -> None:
    op.add_column("builds", sa.Column("attacks", sa.JSON(), nullable=True))

    conn = op.get_bind()
    builds = _builds_table()
    for row in conn.execute(sa.select(builds)).mappings().all():
        entry = {"name": "Attack"}
        for name, _, _, _ in PROFILE_COLUMNS:
            entry[name] = bool(row[name]) if name in BOOLEAN_COLUMNS else row[name]
        attacks = [dict(entry) for _ in range(max(1, row["num_attacks"]))]
        conn.execute(sa.update(builds).where(builds.c.id == row["id"]).values(attacks=attacks))

    # batch mode so this also works on SQLite (no ALTER COLUMN / DROP COLUMN).
    with op.batch_alter_table("builds") as batch:
        batch.alter_column("attacks", existing_type=sa.JSON(), nullable=False)
        for name, _, _, _ in PROFILE_COLUMNS:
            batch.drop_column(name)
        batch.drop_column("num_attacks")


def downgrade() -> None:
    with op.batch_alter_table("builds") as batch:
        for name, type_, server_default, _ in PROFILE_COLUMNS:
            batch.add_column(sa.Column(name, type_, nullable=True, server_default=server_default))
        batch.add_column(sa.Column("num_attacks", sa.Integer(), nullable=True, server_default="1"))

    conn = op.get_bind()
    builds = _builds_table()
    for row in conn.execute(sa.select(builds.c.id, builds.c.attacks)).mappings().all():
        attacks = row["attacks"]
        if isinstance(attacks, str):  # some drivers hand JSON back as text
            attacks = json.loads(attacks)
        first = attacks[0]
        values = {name: first.get(name, py_default) for name, _, _, py_default in PROFILE_COLUMNS}
        values["num_attacks"] = len(attacks)
        conn.execute(sa.update(builds).where(builds.c.id == row["id"]).values(**values))

    with op.batch_alter_table("builds") as batch:
        for name, type_, _, _ in PROFILE_COLUMNS:
            batch.alter_column(name, existing_type=type_, nullable=False)
        batch.alter_column("num_attacks", existing_type=sa.Integer(), nullable=False)
        batch.drop_column("attacks")
