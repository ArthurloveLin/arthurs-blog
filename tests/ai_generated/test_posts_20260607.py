# tested-source: app/api/posts/[id]/engagement/route.ts
"""API integration tests for the post engagement endpoint."""

import allure
import httpx
import pytest


@allure.feature("Posts")
@allure.story("Engagement")
class TestPostEngagement:

    @pytest.mark.smoke
    def test_non_existent_post_engagement_returns_404_or_500(self, client):
        """GET /api/posts/{id}/engagement with a non-existent ID should return 404 or 500."""
        resp = client.get("/api/posts/non-existent-post-id-12345/engagement")
        assert resp.status_code in (404, 500)
        if resp.status_code == 404:
            data = resp.json()
            assert "error" in data
            assert data["error"] == "Post not found"

    def test_post_engagement_with_identity_returns_correct_status(self, client):
        """GET /api/posts/{id}/engagement with identity query parameter."""
        resp = client.get("/api/posts/non-existent-post-id-12345/engagement?identity=test_user")
        assert resp.status_code in (404, 500)
        if resp.status_code == 404:
            data = resp.json()
            assert "error" in data
            assert data["error"] == "Post not found"
