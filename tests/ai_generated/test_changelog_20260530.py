"""API integration tests for the /api/changelog endpoint."""

import allure
import httpx
import pytest


@allure.feature("Changelog")
@allure.story("Changelog GET")
class TestChangelog:

    @pytest.mark.smoke
    def test_get_changelog_latest_returns_200(self, client):
        """GET /api/changelog should return 200 and have latest key in response."""
        resp = client.get("/api/changelog")
        assert resp.status_code == 200
        data = resp.json()
        assert "latest" in data
        latest = data["latest"]
        if latest is not None:
            assert isinstance(latest, dict)
            assert "version" in latest
            assert "date" in latest
            assert "body" in latest

    def test_get_changelog_all_returns_200(self, client):
        """GET /api/changelog?view=all should return 200 and contain entries or latest key."""
        resp = client.get("/api/changelog", params={"view": "all"})
        assert resp.status_code == 200
        data = resp.json()
        assert ("entries" in data) or ("latest" in data)
        if "entries" in data:
            assert isinstance(data["entries"], list)
            for entry in data["entries"]:
                assert isinstance(entry, dict)
                assert "version" in entry
                assert "date" in entry
                assert "body" in entry
        elif "latest" in data:
            assert data["latest"] is None

    def test_changelog_invalid_method(self, client):
        """POST/PUT/DELETE to /api/changelog should return 400, 404, or 405."""
        resp = client.post("/api/changelog")
        assert resp.status_code in (400, 404, 405)
