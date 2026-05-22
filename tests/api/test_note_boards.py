"""
API tests for /api/note-boards/* endpoints.

Endpoints covered:
  GET /api/note-boards/memo          — list memo notes
  GET /api/note-boards/memo/search   — full-text search (GIN trigram index)
  GET /api/note-boards/memo/tags     — tag counts
  GET /api/note-boards/memo/dates    — date hierarchy for calendar sidebar
  GET /api/note-boards/memo/agenda   — notes with upcoming due dates
  GET /api/note-boards/guestbook     — 410 Gone (migrated to /api/comments)
  POST /api/note-boards/guestbook    — 410 Gone (migrated to /api/comments)
  GET /api/note-boards/<invalid>     — 404 Not Found
"""

import allure
import pytest


@allure.feature("Note Boards")
@allure.story("Memo List")
class TestMemoBoardList:

    @pytest.mark.smoke
    def test_memo_board_returns_200(self, client):
        resp = client.get("/api/note-boards/memo")
        assert resp.status_code == 200

    def test_memo_board_response_shape(self, client):
        # Response is {messages: [...], nextOffset: N, hasMore: bool} — not a bare array
        data = client.get("/api/note-boards/memo").json()
        assert "messages" in data
        assert isinstance(data["messages"], list)

    def test_memo_board_pagination_limit(self, client):
        resp = client.get("/api/note-boards/memo", params={"limit": "5"})
        assert resp.status_code == 200
        assert len(resp.json()["messages"]) <= 5

    def test_memo_board_sort_time_desc(self, client):
        resp = client.get("/api/note-boards/memo", params={"sort": "time", "order": "desc"})
        assert resp.status_code == 200

    def test_memo_board_sort_priority(self, client):
        resp = client.get("/api/note-boards/memo", params={"sort": "priority"})
        assert resp.status_code == 200

    def test_memo_board_filter_by_tag(self, client):
        resp = client.get("/api/note-boards/memo", params={"tags": "work"})
        assert resp.status_code == 200

    def test_memo_board_archived_filter(self, client):
        resp = client.get("/api/note-boards/memo", params={"archived": "true"})
        assert resp.status_code == 200


@allure.feature("Note Boards")
@allure.story("Memo Search")
class TestMemoSearch:

    def test_search_returns_results_shape(self, client):
        resp = client.get("/api/note-boards/memo/search", params={"q": "test"})
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert isinstance(data["results"], list)

    def test_search_short_query_returns_empty(self, client):
        resp = client.get("/api/note-boards/memo/search", params={"q": "a"})
        assert resp.status_code == 200
        assert resp.json()["results"] == []

    def test_search_empty_query_returns_empty(self, client):
        resp = client.get("/api/note-boards/memo/search", params={"q": ""})
        assert resp.status_code == 200
        assert resp.json()["results"] == []

    def test_search_limit_capped_at_12(self, client):
        resp = client.get("/api/note-boards/memo/search", params={"q": "memo", "limit": "100"})
        assert resp.status_code == 200
        assert len(resp.json()["results"]) <= 12

    def test_search_result_fields(self, client):
        resp = client.get("/api/note-boards/memo/search", params={"q": "memo"})
        for item in resp.json()["results"]:
            assert "id" in item
            assert "content" in item
            assert "created_at" in item

    def test_search_cache_control_is_private(self, client):
        resp = client.get("/api/note-boards/memo/search", params={"q": "test"})
        # This endpoint is private (user-specific content)
        assert "private" in resp.headers.get("cache-control", "")


@allure.feature("Note Boards")
@allure.story("Memo Tags")
class TestMemoTags:

    def test_tags_returns_array(self, client):
        resp = client.get("/api/note-boards/memo/tags")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_tags_have_name_and_count(self, client):
        data = client.get("/api/note-boards/memo/tags").json()
        for tag in data:
            assert "tag" in tag or "name" in tag


@allure.feature("Note Boards")
@allure.story("Memo Dates")
class TestMemoDates:

    def test_dates_returns_200(self, client):
        resp = client.get("/api/note-boards/memo/dates")
        assert resp.status_code == 200

    def test_dates_response_is_array(self, client):
        assert isinstance(client.get("/api/note-boards/memo/dates").json(), list)


@allure.feature("Note Boards")
@allure.story("Memo Agenda")
class TestMemoAgenda:

    def test_agenda_returns_200(self, client):
        resp = client.get("/api/note-boards/memo/agenda")
        assert resp.status_code == 200

    def test_agenda_response_is_array(self, client):
        assert isinstance(client.get("/api/note-boards/memo/agenda").json(), list)


@allure.feature("Note Boards")
@allure.story("Guestbook (Migrated)")
class TestGuestbookBoard:
    """Guestbook reads/writes were migrated to /api/comments via the engagement-worker.
    /api/note-boards/guestbook returns 410 Gone for both GET and POST."""

    def test_guestbook_list_returns_410(self, client):
        resp = client.get("/api/note-boards/guestbook")
        assert resp.status_code == 410

    def test_guestbook_post_returns_410(self, client):
        resp = client.post("/api/note-boards/guestbook", json={"author": "test", "content": "hello"})
        assert resp.status_code == 410

    def test_invalid_board_slug_returns_404(self, client):
        resp = client.get("/api/note-boards/nonexistent-board-xyz")
        assert resp.status_code == 404
