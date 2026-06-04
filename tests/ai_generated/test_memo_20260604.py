# tested-source: app/api/memo/check-reminders/route.ts
"""API integration tests for the memo check-reminders endpoint."""

import allure
import httpx
import pytest


@allure.feature("Memo")
@allure.story("Check Reminders")
class TestMemoCheckReminders:

    @pytest.mark.smoke
    def test_check_reminders_unauthorized(self, client):
        """POST /api/memo/check-reminders without Authorization header returns 401 or 500."""
        resp = client.post("/api/memo/check-reminders")
        assert resp.status_code in (401, 500)

        data = resp.json()
        assert "error" in data

    def test_check_reminders_invalid_token(self, client):
        """POST /api/memo/check-reminders with an invalid token returns 401 or 500."""
        headers = {"Authorization": "Bearer invalid_token_value_here"}
        resp = client.post("/api/memo/check-reminders", headers=headers)
        assert resp.status_code in (401, 500)

        data = resp.json()
        assert "error" in data

    def test_check_reminders_wrong_method(self, client):
        """GET /api/memo/check-reminders returns 401, 405, or 500."""
        resp = client.get("/api/memo/check-reminders")
        assert resp.status_code in (401, 405, 500)
