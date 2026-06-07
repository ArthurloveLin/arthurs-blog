# tested-source: app/api/genius/route.ts
"""API tests for the Genius proxy endpoint."""

import allure
import httpx
import pytest


@allure.feature("Genius")
@allure.story("Lyrics Proxy")
class TestGenius:

    @pytest.mark.smoke
    def test_missing_params_returns_400(self, client):
        """GET /api/genius without title or artist should return 400."""
        resp = client.get("/api/genius")
        assert resp.status_code == 400
        assert "error" in resp.json()

    def test_missing_artist_returns_400(self, client):
        """GET /api/genius with title but missing artist should return 400."""
        resp = client.get("/api/genius?title=Hello")
        assert resp.status_code == 400
        assert "error" in resp.json()

    def test_missing_title_returns_400(self, client):
        """GET /api/genius with artist but missing title should return 400."""
        resp = client.get("/api/genius?artist=Adele")
        assert resp.status_code == 400
        assert "error" in resp.json()

    def test_valid_request_returns_valid_status(self, client):
        """GET /api/genius with valid params should return 200, 502, or 503 depending on worker availability."""
        resp = client.get("/api/genius?title=Hello&artist=Adele")
        assert resp.status_code in (200, 502, 503)
        if resp.status_code == 200:
            data = resp.json()
            assert "data" in data or "error" in data
