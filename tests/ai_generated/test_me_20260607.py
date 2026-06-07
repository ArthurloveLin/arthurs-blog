# tested-source: app/api/me/route.ts
"""API integration tests for the /api/me session endpoint."""

import allure
import httpx
import pytest


@allure.feature("Auth")
@allure.story("Current Session")
class TestMe:

    @pytest.mark.smoke
    def test_unauthenticated_session(self, client):
        """GET /api/me without credentials returns 200 with null user details."""
        resp = client.get("/api/me")
        assert resp.status_code == 200

        data = resp.json()
        assert "role" in data
        assert "email" in data
        assert "display_name" in data
        assert data["email"] is None

    @pytest.mark.admin
    def test_authenticated_admin_session(self, admin_client):
        """GET /api/me with admin credentials returns 200 with admin user details."""
        resp = admin_client.get("/api/me")
        assert resp.status_code == 200

        data = resp.json()
        assert "role" in data
        assert "email" in data
        assert "display_name" in data
        assert data["email"] is not None
