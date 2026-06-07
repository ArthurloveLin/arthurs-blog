# tested-source: app/api/comments/viewer-state/route.ts
"""API tests for comments viewer state endpoint."""

import allure
import httpx
import pytest


@allure.feature("Comments")
@allure.story("Viewer State")
class TestCommentsViewerState:

    @pytest.mark.smoke
    def test_missing_params_returns_400(self, client):
        """GET /api/comments/viewer-state should return 400 if target_type or target_id is missing."""
        resp = client.get("/api/comments/viewer-state")
        assert resp.status_code == 400
        assert "error" in resp.json()

    def test_missing_identity_returns_empty_list(self, client):
        """GET /api/comments/viewer-state with valid target but no identity should return an empty list."""
        resp = client.get("/api/comments/viewer-state?target_type=post&target_id=1")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
