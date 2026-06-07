# tested-source: app/api/life-gallery/image/[...key]/route.ts
# tested-source: app/api/life-gallery/round/route.ts
"""API integration tests for Life Gallery endpoints."""

import allure
import httpx
import pytest


@allure.feature("Life Gallery")
@allure.story("Image Proxy")
class TestLifeGalleryImage:

    @pytest.mark.smoke
    def test_invalid_key_returns_400(self, client):
        """GET /api/life-gallery/image/[...key] with key not starting with Gallery/ returns 400."""
        resp = client.get("/api/life-gallery/image/not-gallery/image.jpg")
        assert resp.status_code == 400
        assert "Invalid gallery key" in resp.text

    def test_nonexistent_key_returns_404_or_500(self, client):
        """GET /api/life-gallery/image/[...key] with nonexistent key returns 404 or 500."""
        resp = client.get("/api/life-gallery/image/Gallery/does-not-exist.jpg")
        assert resp.status_code in (404, 500)


@allure.feature("Life Gallery")
@allure.story("Round Data")
class TestLifeGalleryRound:

    @pytest.mark.smoke
    def test_get_round_returns_valid_response(self, client):
        """GET /api/life-gallery/round should return 200 or 500."""
        resp = client.get("/api/life-gallery/round")
        assert resp.status_code in (200, 500)

        data = resp.json()
        if resp.status_code == 200:
            assert isinstance(data, (dict, list))
        else:
            assert "error" in data
            assert "Life Gallery" in data["error"]

        cache_control = resp.headers.get("cache-control", "")
        assert "public" in cache_control
