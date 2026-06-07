"""
API tests for memo dispatch endpoints.

POST /api/memo/check-reminders is a token-gated cron dispatcher (Bearer
REMINDER_CHECK_TOKEN). We only exercise the rejection path: a missing or wrong
token must be refused before any reminder is sent. The endpoint fails closed —
if the server has no REMINDER_CHECK_TOKEN configured it returns 500 rather than
running open — so both outcomes (401 wrong token, 500 unconfigured) are accepted.

The authorized happy path is intentionally NOT tested: it dispatches real ntfy
notifications.
"""

import allure
import pytest


@allure.feature("Memo Reminders")
@allure.story("Dispatch Auth")
class TestCheckRemindersAuth:

    @pytest.mark.smoke
    def test_missing_token_is_rejected(self, client):
        resp = client.post("/api/memo/check-reminders")
        assert resp.status_code in (401, 500)

    def test_wrong_token_is_rejected(self, client):
        resp = client.post(
            "/api/memo/check-reminders",
            headers={"Authorization": "Bearer definitely-not-the-token"},
        )
        assert resp.status_code in (401, 500)
