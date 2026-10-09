"""Alembic migrations against a real (file-backed SQLite) database.

The app tests use Base.metadata.create_all, so they never exercise the
migration files -- these do: upgrade from an older revision with data in
it, and check the data survives.
"""

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.calculator import had
from app.db import get_db
from app.main import app
from tests.conftest import _override_get_db


@pytest.fixture
def db_url(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'migrations.db'}"
    monkeypatch.setenv("DATABASE_URL", url)  # alembic/env.py prefers this
    return url


def _alembic(direction: str, revision: str) -> None:
    cfg = Config("alembic.ini")
    getattr(command, direction)(cfg, revision)


OLD_BUILDS = [
    # Extra Attack fighter with GWM: two identical power-attack swings.
    dict(
        id=1,
        name="GWM Fighter",
        attack_bonus=8,
        num_dice=2,
        die_sides=6,
        modifier=5,
        num_attacks=2,
        advantage=False,
        disadvantage=False,
        crit_range=19,
        power_attack=True,
        power_attack_bonus=10,
        power_attack_penalty=-5,
    ),
    # Single attack with advantage, no power attack.
    dict(
        id=2,
        name="Rogue",
        attack_bonus=7,
        num_dice=1,
        die_sides=6,
        modifier=4,
        num_attacks=1,
        advantage=True,
        disadvantage=False,
        crit_range=20,
        power_attack=False,
        power_attack_bonus=0,
        power_attack_penalty=0,
    ),
]


def _seed_old_schema(url: str) -> None:
    _alembic("upgrade", "0001")
    engine = sa.create_engine(url)
    with engine.begin() as conn:
        builds = sa.Table("builds", sa.MetaData(), autoload_with=conn)
        conn.execute(builds.insert(), OLD_BUILDS)
    engine.dispose()


def test_0002_turns_num_attacks_into_identical_entries(db_url):
    _seed_old_schema(db_url)
    _alembic("upgrade", "head")

    engine = sa.create_engine(db_url)
    columns = {c["name"] for c in sa.inspect(engine).get_columns("builds")}
    assert "attacks" in columns
    assert not {"num_attacks", "attack_bonus", "power_attack"} & columns

    # Read back through the real API, pointed at the migrated database.
    session_factory = sessionmaker(bind=engine)

    def migrated_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = migrated_db
    try:
        client = TestClient(app)
        builds = {b["name"]: b for b in client.get("/api/builds").json()}
        fighter, rogue = builds["GWM Fighter"]["attacks"], builds["Rogue"]["attacks"]

        assert len(fighter) == 2 and fighter[0] == fighter[1]
        assert fighter[0] == {
            "name": "Attack",
            "attack_bonus": 8,
            "num_dice": 2,
            "die_sides": 6,
            "modifier": 5,
            "crit_range": 19,
            "advantage": False,
            "disadvantage": False,
            "power_attack": True,
            "power_attack_bonus": 10,
            "power_attack_penalty": -5,
        }
        assert len(rogue) == 1 and rogue[0]["advantage"] is True

        # The migrated build's round total equals the old formula (HAD x N).
        res = client.post("/api/builds/1/calculate", json={"ac_list": [16]}).json()
        assert res["results"][0]["total_had"] == pytest.approx(
            had(8, 16, 2, 6, 5, 10, -5, False, False, 19) * 2
        )
    finally:
        app.dependency_overrides[get_db] = _override_get_db
        engine.dispose()


def test_0002_downgrade_restores_the_old_columns(db_url):
    _seed_old_schema(db_url)
    _alembic("upgrade", "head")
    _alembic("downgrade", "0001")

    engine = sa.create_engine(db_url)
    with engine.connect() as conn:
        builds = sa.Table("builds", sa.MetaData(), autoload_with=conn)
        rows = [dict(r) for r in conn.execute(sa.select(builds).order_by(builds.c.id)).mappings()]
    engine.dispose()

    for row, old in zip(rows, OLD_BUILDS, strict=True):
        for key, value in old.items():
            assert row[key] == value, key
