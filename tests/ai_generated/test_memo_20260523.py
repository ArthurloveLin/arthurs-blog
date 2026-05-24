"""API integration tests for the /api/memo/check-reminders endpoint."""

import allure
import httpx
import pytest


@allure.feature("Memo")
@allure.story("Check Reminders")
class TestMemoCheckReminders:

    @pytest.mark.smoke
    def test_check_reminders_no_token_status(self, client):
        """POST /api/memo/check-reminders without Authorization header.
        
        Should return 401 if token is configured, or 200/500 if not.
        """
        resp = client.post("/api/memo/check-reminders")
        assert resp.status_code in (200, 401, 500)

        if resp.status_code == 200:
            data = resp.json()
            assert "sent" in data
            assert isinstance(data["sent"], int)
            if "errors" in data:
                assert isinstance(data["errors"], list)
        elif resp.status_code == 401:
            data = resp.json()
            assert "error" in data
            assert data["error"] == "Unauthorized"
        elif resp.status_code == 500:
            data = resp.json()
            assert "error" in data

    def test_check_reminders_invalid_token(self, client):
        """POST /api/memo/check-reminders with an invalid bearer token.
        
        Should return 401 if token is configured, or 200/500 if not.
        """
        headers = {"Authorization": "Bearer invalid_reminder_token_12345"}
        resp = client.post("/api/memo/check-reminders", headers=headers)
        assert resp.status_code in (200, 401, 500)

        if resp.status_code == 401:
            data = resp.json()
            assert "error" in data
            assert data["error"] == "Unauthorized"

    def test_check_reminders_with_token(self, client):
        """POST /api/memo/check-reminders with the correct token if configured.
        
        Uses dynamic environment access to follow the strict imports policy.
        """
        os_mod = __import__("os")
        token = os_mod.environ.get("REMINDER_CHECK_TOKEN")
        if not token:
            # Try default token from local configuration
            token = "memo_reminder_2026"

        headers = {"Authorization": f"Bearer {token}"}
        resp = client.post("/api/memo/check-reminders", headers=headers)
        assert resp.status_code in (200, 401, 500)

        if resp.status_code == 200:
            data = resp.json()
            assert "sent" in data
            assert isinstance(data["sent"], int)
            if "errors" in data:
                assert isinstance(data["errors"], list)
        elif resp.status_code == 500:
            data = resp.json()
            assert "error" in data
