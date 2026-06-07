# tested-source: app/api/sessions/[token]/rankings/route.ts
"""API integration tests for the sessions rankings endpoint."""

import allure
import httpx
import pytest


@allure.feature("Sessions")
@allure.story("Rankings")
class TestSessionsRankings:

    @pytest.mark.smoke
    def test_public_client_is_forbidden(self, client):
        """PATCH /api/sessions/{token}/rankings with unauthenticated client returns 403."""
        resp = client.patch("/api/sessions/some-token/rankings", json={
            "championId": "item1",
            "runnerUpId": "item2"
        })
        assert resp.status_code == 403

    @pytest.mark.admin
    def test_missing_required_fields_returns_400(self, admin_client):
        """PATCH /api/sessions/{token}/rankings with missing fields returns 400."""
        resp = admin_client.patch("/api/sessions/some-token/rankings", json={})
        assert resp.status_code == 400
        assert resp.json().get("error") == "Champion and runner-up are required"

    @pytest.mark.admin
    def test_duplicate_rankings_returns_400(self, admin_client):
        """PATCH /api/sessions/{token}/rankings with duplicate items returns 400."""
        resp = admin_client.patch("/api/sessions/some-token/rankings", json={
            "championId": "item1",
            "runnerUpId": "item1"
        })
        assert resp.status_code == 400
        assert resp.json().get("error") == "Each rank must belong to a different item"

    @pytest.mark.admin
    def test_non_existent_session_returns_404_or_500(self, admin_client):
        """PATCH /api/sessions/{token}/rankings with non-existent token returns 404 or 500."""
        resp = admin_client.patch("/api/sessions/non-existent-token-12345/rankings", json={
            "championId": "item1",
            "runnerUpId": "item2"
        })
        assert resp.status_code in (404, 500)
        if resp.status_code == 404:
            assert resp.json().get("error") == "Session not found"
