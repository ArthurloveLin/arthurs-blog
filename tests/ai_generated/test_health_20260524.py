"""API tests for the /api/health endpoint."""

import allure
import httpx
import pytest


@allure.feature("Health")
@allure.story("Endpoint Status")
class TestHealth:

    @pytest.mark.smoke
    def test_health_check_returns_200(self, client):
        """GET /api/health should return 200 with status 'ok'."""
        resp = client.get("/api/health")
        assert resp.status_code == 200

        data = resp.json()
        assert "status" in data
        assert data["status"] == "ok"
        assert "timestamp" in data
        assert isinstance(data["timestamp"], str)

    def test_health_check_headers(self, client):
        """GET /api/health should have Cache-Control header set to no-store."""
        resp = client.get("/api/health")
        assert resp.status_code == 200

        cache_control = resp.headers.get("cache-control", "")
        assert "no-store" in cache_control
        assert "max-age=0" in cache_control
