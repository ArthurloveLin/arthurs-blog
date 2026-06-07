"""
Auth-enforcement tests for admin-gated and secret-gated endpoints.

All run with the UNAUTHENTICATED `client` (no creds required) and assert the
endpoint rejects the request before doing any work:
  - app/api/admin/*                         → isAdminRequest() → 403
  - app/api/sessions POST, [token] PATCH/DELETE → isAdminRequest() → 403
  - app/api/revalidate (Spotify secret)     → 401 without a valid ?secret=

These guard against a silent auth regression that would expose uploads, deletes,
and cache-busting to the public. None of them mutate data: the admin check runs
first, and the sessions mutation path is only ever reached with a bogus token
that the 403 short-circuits before any DB call.
"""

import allure
import pytest

ZERO_UUID = "00000000-0000-0000-0000-000000000000"

# (path, exported verb) — verbs verified against each route.ts handler.
ADMIN_GET = [
    "/api/admin/config",
    "/api/admin/live2d/scan",
]
ADMIN_POST = [
    "/api/admin/config",
    "/api/admin/revalidate",
    "/api/admin/delete-recipe-image",
    "/api/admin/upload-image",
    "/api/admin/upload-recipe-image",
    "/api/admin/now-watching/revalidate",
]


@allure.feature("Auth Enforcement")
@allure.story("Admin Endpoints")
class TestAdminAuthEnforcement:

    @pytest.mark.smoke
    @pytest.mark.parametrize("path", ADMIN_GET)
    def test_admin_get_requires_auth(self, client, path):
        assert client.get(path).status_code == 403

    @pytest.mark.smoke
    @pytest.mark.parametrize("path", ADMIN_POST)
    def test_admin_post_requires_auth(self, client, path):
        # Empty body is safe: isAdminRequest() returns 403 before body parsing.
        assert client.post(path, json={}).status_code == 403


@allure.feature("Auth Enforcement")
@allure.story("Sessions Mutations")
class TestSessionsAuthEnforcement:

    def test_create_session_requires_auth(self, client):
        assert client.post("/api/sessions", json={"title": "x"}).status_code == 403

    def test_patch_session_requires_auth(self, client):
        resp = client.patch(f"/api/sessions/{ZERO_UUID}", json={"title": "x"})
        assert resp.status_code == 403

    def test_delete_session_requires_auth(self, client):
        # Auth check precedes the token lookup, so no row is ever touched.
        assert client.delete(f"/api/sessions/{ZERO_UUID}").status_code == 403


@allure.feature("Auth Enforcement")
@allure.story("Secret-Gated Revalidate")
class TestRevalidateSecret:

    @pytest.mark.smoke
    def test_revalidate_without_secret_returns_401(self, client):
        assert client.get("/api/revalidate").status_code == 401

    def test_revalidate_with_wrong_secret_returns_401(self, client):
        resp = client.get("/api/revalidate", params={"secret": "definitely-wrong"})
        assert resp.status_code == 401
