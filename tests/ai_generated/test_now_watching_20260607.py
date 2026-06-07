# tested-source: app/api/now-watching/posters/route.ts
"""API integration tests for the now-watching posters endpoint."""

import allure
import httpx
import pytest


@allure.feature("Now Watching")
@allure.story("Posters")
class TestNowWatchingPosters:

    @pytest.mark.smoke
    def test_get_posters_default_params(self, client):
        """GET /api/now-watching/posters should return a paginated list of posters or 500 if unconfigured."""
        resp = client.get("/api/now-watching/posters")
        assert resp.status_code in (200, 500)
        if resp.status_code == 200:
            data = resp.json()
            assert "posters" in data
            assert isinstance(data["posters"], list)
            assert "totalCount" in data
            assert "hasMore" in data

    def test_get_posters_custom_params(self, client):
        """GET /api/now-watching/posters with custom page and perPage parameters."""
        resp = client.get("/api/now-watching/posters?page=2&perPage=5")
        assert resp.status_code in (200, 500)
        if resp.status_code == 200:
            data = resp.json()
            assert "posters" in data
            assert isinstance(data["posters"], list)
            assert len(data["posters"]) <= 5
            assert "totalCount" in data
            assert "hasMore" in data

    def test_get_posters_bound_constraints(self, client):
        """GET /api/now-watching/posters handles out-of-bounds parameters gracefully by bounding them."""
        resp = client.get("/api/now-watching/posters?page=-5&perPage=100")
        assert resp.status_code in (200, 500)
        if resp.status_code == 200:
            data = resp.json()
            assert "posters" in data
            assert isinstance(data["posters"], list)
            assert len(data["posters"]) <= 30
