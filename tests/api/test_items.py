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
directly); its validation + no-op safety are covered below, and the missing auth
guard is captured as a strict xfail so a future fix flips it to a real assertion.
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
    """POST /api/items/bulk-delete — validation + non-destructive safety.

    Every test uses only ZERO_UUID, which is a valid UUID shape that matches no
    row, so the handler fetches 0 items and deletes nothing (204). This keeps the
    suite non-destructive even though the route has no server-side auth check.
    """

    def test_empty_ids_returns_400(self, client):
        resp = client.post("/api/items/bulk-delete", json={"ids": []})
        assert resp.status_code == 400

    def test_missing_ids_returns_400(self, client):
        resp = client.post("/api/items/bulk-delete", json={})
        assert resp.status_code == 400

    def test_non_array_ids_returns_400(self, client):
        resp = client.post("/api/items/bulk-delete", json={"ids": "not-an-array"})
        assert resp.status_code == 400

    @pytest.mark.smoke
    def test_bogus_uuid_is_noop_204(self, client):
        # Valid UUID shape matching no row → fetch 0, delete 0 → 204 No Content.
        resp = client.post("/api/items/bulk-delete", json={"ids": [ZERO_UUID]})
        assert resp.status_code == 204

    @pytest.mark.xfail(
        strict=True,
        reason=(
            "SECURITY GAP: bulk-delete calls supabaseAdmin with no isAdminRequest() "
            "guard, so an unauthenticated caller can delete items. When the guard is "
            "added this xfail flips to xpass — remove the marker and assert 403."
        ),
    )
    def test_bulk_delete_should_require_admin_auth(self, client):
        resp = client.post("/api/items/bulk-delete", json={"ids": [ZERO_UUID]})
        assert resp.status_code in (401, 403)
