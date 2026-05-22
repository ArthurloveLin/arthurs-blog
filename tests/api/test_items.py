"""
API tests for /api/items/* endpoints (wardrobe items).

Endpoints covered:
  GET    /api/items                    (admin only — wardrobe data)
  POST   /api/items                    (admin, multipart form with image)
  GET    /api/items/[id]               (admin)
  PUT    /api/items/[id]               (admin)
  DELETE /api/items/[id]               (admin)
  POST   /api/items/bulk-delete        (admin)
  POST   /api/items/reorder            (admin)

Note: POST /api/items is multipart (file upload + session token), so write
tests are not included here — they require R2 access and real image data.
The focus is on auth enforcement and GET behavior.
"""

import allure
import pytest


@allure.feature("Wardrobe Items")
@allure.story("Auth Enforcement")
class TestItemsAuthEnforcement:

    @pytest.mark.smoke
    def test_post_items_is_protected(self, client):
        # GET is not defined on /api/items (returns 405); POST without auth returns 403
        resp = client.post("/api/items", data={"sessionToken": "fake-token"})
        assert resp.status_code in (401, 403)

    def test_post_items_requires_auth(self, client):
        resp = client.post("/api/items", data={"sessionToken": "fake"})
        assert resp.status_code in (401, 403)

    def test_bulk_delete_requires_auth(self, client):
        resp = client.post("/api/items/bulk-delete", json={"ids": []})
        assert resp.status_code in (401, 403)

    def test_reorder_requires_auth(self, client):
        resp = client.post("/api/items/reorder", json={"items": []})
        assert resp.status_code in (401, 403)


@allure.feature("Wardrobe Items")
@allure.story("Admin Access")
class TestItemsAdminAccess:

    @pytest.mark.admin
    def test_admin_can_list_items(self, admin_client):
        resp = admin_client.get("/api/items")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.admin
    def test_list_items_fields(self, admin_client):
        data = admin_client.get("/api/items").json()
        for item in data:
            assert "id" in item
            assert "session_id" in item or "image_url" in item

    @pytest.mark.admin
    def test_get_nonexistent_item_returns_404(self, admin_client):
        resp = admin_client.get("/api/items/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404
