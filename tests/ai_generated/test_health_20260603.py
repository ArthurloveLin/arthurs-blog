# tested-source: app/api/health/route.ts
"""API tests for the /api/health endpoint."""

import allure
import httpx
import pytest


@allure.feature("Health")
@allure.story("Endpoint Status")
class TestHealth:

    @pytest.mark.smoke
    def test_health_check_returns_valid_status(self, client):
        """GET /api/health should return 200 or 503 depending on database status."""
        resp = client.get("/api/health")
        assert resp.status_code in (200, 503)

        data = resp.json()
        assert "status" in data
        assert data["status"] in ("ok", "degraded", "down")
        assert "timestamp" in data
        assert isinstance(data["timestamp"], str)

        components = data.get("components", {})
        assert "database" in components
        assert "status" in components["database"]
        assert components["database"]["status"] in ("ok", "down")
        assert "latency_ms" in components["database"]
        assert isinstance(components["database"]["latency_ms"], (int, float))

        assert "workers" in components
        workers = components["workers"]
        expected_workers = [
            "genius",
            "engagement",
            "spotify_now_playing",
            "spotify_sync",
            "wardrobe_proxy",
        ]
        for worker in expected_workers:
            assert worker in workers
            assert "status" in workers[worker]
            assert workers[worker]["status"] in (
                "ok",
                "degraded",
                "down",
                "timeout",
                "unreachable",
            )
            assert "latency_ms" in workers[worker]
            assert isinstance(workers[worker]["latency_ms"], (int, float))
            assert "components" in workers[worker]

    def test_health_check_headers(self, client):
        """GET /api/health should have Cache-Control header set to no-store, max-age=0."""
        resp = client.get("/api/health")
        assert resp.status_code in (200, 503)

        cache_control = resp.headers.get("cache-control", "")
        assert "no-store" in cache_control
        assert "max-age=0" in cache_control

    def test_health_check_invalid_method(self, client):
        """POST /api/health should return 405 Method Not Allowed or 404."""
        resp = client.post("/api/health")
        assert resp.status_code in (404, 405)
