"""
API tests for POST /api/contact.

The required-field and length checks run before Turnstile verification and the
DB insert, so they are non-destructive. The success path is intentionally NOT
tested: it inserts a contact message and fires an ntfy notification, and for
anonymous callers depends on Turnstile (which may fail open in a test env).
"""

import allure
import pytest


@allure.feature("Contact")
@allure.story("Validation")
class TestContactValidation:

    @pytest.mark.smoke
    def test_missing_fields_returns_400(self, client):
        assert client.post("/api/contact", json={}).status_code == 400
        assert client.post("/api/contact", json={"name": "x"}).status_code == 400
        assert client.post("/api/contact", json={"message": "hi"}).status_code == 400

    def test_message_too_long_returns_400(self, client):
        resp = client.post("/api/contact", json={"name": "visitor", "message": "a" * 1001})
        assert resp.status_code == 400
