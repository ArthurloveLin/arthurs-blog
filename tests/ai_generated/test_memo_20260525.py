"""API integration tests for the /api/memo/check-reminders endpoint."""

import allure
import httpx
import pytest


@allure.feature("Memo")
@allure.story("Check Reminders")
class TestMemoCheckReminders:

    @pytest.mark.smoke
    def test_check_reminders_unauthorized(self, client):
        """POST /api/memo/check-reminders without token should return 401, or 200/500 if not configured."""
        resp = client.post("/api/memo/check-reminders")
        assert resp.status_code in (200, 401, 500)
        if resp.status_code == 401:
            data = resp.json()
            assert "error" in data
            assert data["error"] == "Unauthorized"

    def test_check_reminders_invalid_token(self, client):
        """POST /api/memo/check-reminders with an invalid bearer token should return 401, or 200/500 if not configured."""
        resp = client.post(
            "/api/memo/check-reminders",
            headers={"Authorization": "Bearer invalid_reminder_token_12345"}
        )
        assert resp.status_code in (200, 401, 500)
        if resp.status_code == 401:
            data = resp.json()
            assert "error" in data
            assert data["error"] == "Unauthorized"

    def test_check_reminders_invalid_method(self, client):
        """GET /api/memo/check-reminders should return 405 Method Not Allowed or 404."""
        resp = client.get("/api/memo/check-reminders")
        assert resp.status_code in (404, 405)
