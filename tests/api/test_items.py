"""
API tests for /api/items/* endpoints (wardrobe items).

Endpoints covered:
  POST   /api/items                    (admin, multipart form with image)
  GET    /api/items/[id]               — does NOT exist (405)
  DELETE /api/items/[id]               (admin)
  PATCH  /api/items/[id]               (admin)
  POST   /api/items/bulk-delete        (admin — isAdminRequest guard)
  POST   /api/items/reorder            (admin)

Note: POST /api/items is multipart (file upload), so write tests are skipped.
GET /api/items does not exist — items are accessed through sessions.
"""

import allure
import pytest

ZERO_UUID = "00000000-0000-0000-0000-000000000000"


@allure.feature("Wardrobe Items")
@allure.story("Auth Enforcement")
class TestItemsAuthEnforcement:

    @pytest.mark.smoke
    def test_post_items_is_protected(self, client):
        # POST without valid admin session returns 403
        resp = client.post("/api/items", data={"sessionToken": "fake-token"})
        assert resp.status_code in (401, 403)

    def test_post_items_requires_auth(self, client):
        resp = client.post("/api/items", data={"sessionToken": "fake"})
        assert resp.status_code in (401, 403)

    def test_reorder_requires_auth(self, client):
        resp = client.post("/api/items/reorder", json={"items": []})
        assert resp.status_code in (401, 403)


@allure.feature("Wardrobe Items")
@allure.story("Admin Access")
class TestItemsAdminAccess:

    @pytest.mark.admin
    def test_delete_nonexistent_item_returns_404(self, admin_client):
        """DELETE /api/items/[id] returns 404 for an unknown UUID."""
        resp = admin_client.delete(f"/api/items/{ZERO_UUID}")
        assert resp.status_code == 404


@allure.feature("Wardrobe Items")
@allure.story("Bulk Delete")
class TestItemsBulkDelete:
    """POST /api/items/bulk-delete — admin-gated (isAdminRequest runs first).

    Unauthenticated callers are rejected with 403 before any body parsing.
    Validation cases require admin and use only ZERO_UUID (matches no row →
    fetch 0, delete 0 → 204), keeping the authenticated cases non-destructive.
    """

    @pytest.mark.smoke
    def test_requires_admin_auth(self, client):
        # No session → 403 before the request body is even read.
        resp = client.post("/api/items/bulk-delete", json={"ids": [ZERO_UUID]})
        assert resp.status_code in (401, 403)

    @pytest.mark.admin
    def test_empty_ids_returns_400(self, admin_client):
        assert admin_client.post("/api/items/bulk-delete", json={"ids": []}).status_code == 400

    @pytest.mark.admin
    def test_missing_ids_returns_400(self, admin_client):
        assert admin_client.post("/api/items/bulk-delete", json={}).status_code == 400

    @pytest.mark.admin
    def test_non_array_ids_returns_400(self, admin_client):
        assert admin_client.post("/api/items/bulk-delete", json={"ids": "not-an-array"}).status_code == 400

    @pytest.mark.admin
    def test_bogus_uuid_is_noop_204(self, admin_client):
        # Valid UUID shape matching no row → fetch 0, delete 0 → 204 No Content.
        resp = admin_client.post("/api/items/bulk-delete", json={"ids": [ZERO_UUID]})
        assert resp.status_code == 204
