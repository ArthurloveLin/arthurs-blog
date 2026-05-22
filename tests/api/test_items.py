"""
API tests for /api/items/* endpoints (wardrobe items).

Endpoints covered:
  POST   /api/items                    (admin, multipart form with image)
  GET    /api/items/[id]               — does NOT exist (405)
  DELETE /api/items/[id]               (admin)
  PATCH  /api/items/[id]               (admin)
  POST   /api/items/bulk-delete        (no auth check — application-level gap)
  POST   /api/items/reorder            (admin)

Note: POST /api/items is multipart (file upload), so write tests are skipped.
GET /api/items does not exist — items are accessed through sessions.
POST /api/items/bulk-delete has no server-side auth check (uses supabaseAdmin
directly); this is an application-level gap, not tested as auth enforcement.
"""

import allure
import pytest


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
        resp = admin_client.delete("/api/items/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404
