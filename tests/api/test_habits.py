# tested-source: app/api/note-boards/memo/habits/complete/route.ts
# tested-source: app/api/note-boards/memo/habits/delay/route.ts
# tested-source: app/api/note-boards/memo/habits/occurrence/[id]/route.ts
"""
API tests for memo habit mutation endpoints.

All three routes delegate to lib/memo-habits-server, which authorizes the note
(or fetches the occurrence) BEFORE any write. So bogus-uuid calls are
non-destructive: an unauthenticated caller hitting a non-existent / unowned note
is rejected (403/404) without mutating anything. We cover validation + that
ownership gate; the happy path needs a seeded owned note and is deferred.
"""

import allure
import pytest

ZERO_UUID = "00000000-0000-0000-0000-000000000000"


@allure.feature("Memo Habits")
@allure.story("Complete Occurrence")
class TestHabitComplete:

    def test_missing_fields_returns_400(self, client):
        assert client.post("/api/note-boards/memo/habits/complete", json={}).status_code == 400
        resp = client.post("/api/note-boards/memo/habits/complete", json={"note_id": ZERO_UUID})
        assert resp.status_code == 400

    @pytest.mark.smoke
    def test_unowned_note_is_rejected(self, client):
        resp = client.post(
            "/api/note-boards/memo/habits/complete",
            json={"note_id": ZERO_UUID, "item_key": "task-1"},
        )
        assert resp.status_code in (403, 404)


@allure.feature("Memo Habits")
@allure.story("Delay Occurrence")
class TestHabitDelay:

    def test_missing_fields_returns_400(self, client):
        assert client.post("/api/note-boards/memo/habits/delay", json={}).status_code == 400
        # note_id + item_key present but delay_until missing → still 400
        resp = client.post(
            "/api/note-boards/memo/habits/delay",
            json={"note_id": ZERO_UUID, "item_key": "task-1"},
        )
        assert resp.status_code == 400

    def test_unowned_note_is_rejected(self, client):
        resp = client.post(
            "/api/note-boards/memo/habits/delay",
            json={"note_id": ZERO_UUID, "item_key": "task-1", "delay_until": "2026-06-08T10:00:00Z"},
        )
        assert resp.status_code in (403, 404)


@allure.feature("Memo Habits")
@allure.story("Delete Occurrence")
class TestHabitOccurrenceDelete:

    def test_unknown_occurrence_is_rejected(self, client):
        # The occurrence row is fetched before any delete → bogus id is a no-op.
        resp = client.delete(f"/api/note-boards/memo/habits/occurrence/{ZERO_UUID}")
        assert resp.status_code in (403, 404)
