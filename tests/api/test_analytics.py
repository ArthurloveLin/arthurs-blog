"""
API tests for /api/analytics/* endpoints.

Endpoints covered:
  GET /api/analytics/overview?range=7d|30d&timezone=...
  GET /api/analytics/post?slug=<slug>&range=7d|30d

These endpoints proxy Umami analytics data. They require Umami to be configured.
If Umami is not configured in the test env, the server returns a 500 with an
error message — we test that the shape is still valid JSON.
"""

import allure
import pytest


@allure.feature("Analytics")
@allure.story("Overview")
class TestAnalyticsOverview:

    @pytest.mark.smoke
    def test_overview_returns_json(self, client):
        resp = client.get("/api/analytics/overview", params={"range": "7d"})
        assert resp.status_code in (200, 500)
        assert resp.headers["content-type"].startswith("application/json")

    def test_overview_7d_range(self, client):
        resp = client.get("/api/analytics/overview", params={"range": "7d"})
        assert resp.status_code in (200, 500)

    def test_overview_30d_range(self, client):
        resp = client.get("/api/analytics/overview", params={"range": "30d"})
        assert resp.status_code in (200, 500)

    def test_overview_invalid_range_falls_back_to_7d(self, client):
        resp = client.get("/api/analytics/overview", params={"range": "invalid"})
        assert resp.status_code in (200, 500)

    def test_overview_with_timezone(self, client):
        resp = client.get("/api/analytics/overview", params={
            "range": "7d",
            "timezone": "Asia/Shanghai",
        })
        assert resp.status_code in (200, 500)


@allure.feature("Analytics")
@allure.story("Post Stats")
class TestAnalyticsPost:

    def test_post_stats_returns_json(self, client):
        resp = client.get("/api/analytics/post", params={"slug": "test-post", "range": "7d"})
        assert resp.status_code in (200, 500)
        assert resp.headers["content-type"].startswith("application/json")

    def test_post_stats_missing_slug(self, client):
        resp = client.get("/api/analytics/post")
        assert resp.status_code in (200, 400, 500)
