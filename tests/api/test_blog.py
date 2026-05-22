"""
API tests for /api/blog/* endpoints.

Endpoints covered:
  GET /api/blog/search?q=<query>&page=<n>&limit=<n>
  POST /api/blog/reindex  (no auth check — intentionally open, idempotent)
"""

import allure
import pytest


@allure.feature("Blog")
@allure.story("Search")
class TestBlogSearch:

    @pytest.mark.smoke
    def test_search_returns_json(self, client):
        resp = client.get("/api/blog/search", params={"q": "memo"})
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("application/json")

    @pytest.mark.smoke
    def test_search_response_shape(self, client):
        resp = client.get("/api/blog/search", params={"q": "blog"})
        data = resp.json()
        # "query" only appears in empty/short-query responses; normal results have page/total/results
        assert "results" in data
        assert isinstance(data["results"], list)

    def test_short_query_returns_empty(self, client):
        """Queries shorter than SEARCH_MIN_QUERY_LENGTH return empty results without error."""
        resp = client.get("/api/blog/search", params={"q": "a"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["results"] == []

    def test_empty_query_returns_empty(self, client):
        resp = client.get("/api/blog/search", params={"q": ""})
        assert resp.status_code == 200
        assert resp.json()["results"] == []

    def test_search_pagination_params(self, client):
        resp = client.get("/api/blog/search", params={"q": "memo", "page": "1", "limit": "3"})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) <= 3

    def test_search_result_fields(self, client):
        resp = client.get("/api/blog/search", params={"q": "spotify"})
        data = resp.json()
        for result in data.get("results", []):
            assert "title" in result or "slug" in result

    def test_special_characters_do_not_crash(self, client):
        for q in ["<script>", "'; DROP TABLE--", "你好", "🎵"]:
            resp = client.get("/api/blog/search", params={"q": q})
            assert resp.status_code in (200, 400), f"Unexpected status for q={q!r}"

    def test_cache_control_header_present(self, client):
        resp = client.get("/api/blog/search", params={"q": "memo"})
        if resp.json().get("total", 0) > 0:
            assert "cache-control" in resp.headers


@allure.feature("Blog")
@allure.story("Reindex")
class TestBlogReindex:

    def test_reindex_accepts_post(self, client):
        """POST /api/blog/reindex has no auth check — it is intentionally open.
        Verify it returns 200 and a JSON summary (not a 4xx/5xx).
        """
        resp = client.post("/api/blog/reindex")
        assert resp.status_code == 200
        data = resp.json()
        assert "summary" in data
