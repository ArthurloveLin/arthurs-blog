"""API integration tests for the /api/changelog endpoint."""

import allure
import httpx
import pytest


@allure.feature("Changelog")
@allure.story("Changelog View")
class TestChangelog:

    @pytest.mark.smoke
    def test_get_changelog_latest_returns_200(self, client):
        """GET /api/changelog should return 200 with latest entry, even if null."""
        resp = client.get("/api/changelog")
        assert resp.status_code == 200
        data = resp.json()
        assert "latest" in data
        latest = data["latest"]
        if latest is not None:
            assert "version" in latest
            assert "date" in latest
            assert "body" in latest

    def test_get_changelog_all_returns_200(self, client):
        """GET /api/changelog?view=all should return 200 with entries array."""
        resp = client.get("/api/changelog", params={"view": "all"})
        assert resp.status_code == 200
        data = resp.json()
        assert "entries" in data
        assert isinstance(data["entries"], list)
        for entry in data["entries"]:
            assert "version" in entry
            assert "date" in entry
            assert "body" in entry

    def test_changelog_invalid_method(self, client):
        """POST /api/changelog should return 405 Method Not Allowed or 404."""
        resp = client.post("/api/changelog")
        assert resp.status_code in (404, 405)
