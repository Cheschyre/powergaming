"""CORS policy: explicit origins only, and none at all when unset-to-empty."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import DEFAULT_CORS_ALLOW_ORIGINS, configure_cors, parse_origins

DEV_ORIGIN = "http://localhost:5173"


def _preflight(client: TestClient, origin: str, method: str = "POST"):
    return client.options(
        "/ping",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": "content-type",
        },
    )


def _app_with(raw_origins: str) -> TestClient:
    app = FastAPI()

    @app.post("/ping")
    def ping() -> dict[str, str]:
        return {"ok": "yes"}

    configure_cors(app, raw_origins)
    return TestClient(app)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("", []),
        (" , ,", []),
        ("http://a.example", ["http://a.example"]),
        (" http://a.example , http://b.example ,", ["http://a.example", "http://b.example"]),
    ],
)
def test_parse_origins(raw, expected):
    assert parse_origins(raw) == expected


def test_default_allows_vite_dev_server():
    assert DEV_ORIGIN in parse_origins(DEFAULT_CORS_ALLOW_ORIGINS)


def test_allowed_origin_gets_cors_headers():
    client = _app_with(DEV_ORIGIN)
    res = _preflight(client, DEV_ORIGIN)
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == DEV_ORIGIN

    res = client.post("/ping", headers={"Origin": DEV_ORIGIN})
    assert res.headers["access-control-allow-origin"] == DEV_ORIGIN


def test_other_origin_is_refused():
    client = _app_with(DEV_ORIGIN)
    res = _preflight(client, "http://evil.example")
    assert res.status_code == 400
    assert "access-control-allow-origin" not in res.headers

    res = client.post("/ping", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in res.headers


def test_unlisted_method_is_refused():
    client = _app_with(DEV_ORIGIN)
    assert _preflight(client, DEV_ORIGIN, method="PUT").status_code == 400


def test_empty_config_disables_cors():
    client = _app_with("")
    res = client.post("/ping", headers={"Origin": DEV_ORIGIN})
    assert res.status_code == 200
    assert "access-control-allow-origin" not in res.headers


def test_real_app_allows_dev_origin_by_default(client):
    # The `client` fixture wraps app.main.app, configured from the default.
    res = client.get("/health", headers={"Origin": DEV_ORIGIN})
    assert res.headers["access-control-allow-origin"] == DEV_ORIGIN
    res = client.get("/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in res.headers
