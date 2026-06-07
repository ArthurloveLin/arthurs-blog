"""
API tests for PUT /api/ratings.

The route validates required fields before any DB write, so the 400 cases are
fully non-destructive. It has NO auth check and writes via supabaseAdmin; that
security gap is captured as a strict xfail that stays non-destructive because the
bogus item_id violates the ratings→items foreign key, so the upsert is rejected
(500) and no row persists.

Deferred (needs a seeded item + cleanup, not feasible without admin multipart
upload): the happy upsert path and onConflict idempotency.
"""

import allure
import pytest

ZERO_UUID = "00000000-0000-0000-0000-000000000000"


@allure.feature("Ratings")
@allure.story("Validation")
class TestRatingsValidation:

    def test_missing_item_id_returns_400(self, client):
        resp = client.put("/api/ratings", json={"author": "pytest"})
        assert resp.status_code == 400

    def test_missing_author_returns_400(self, client):
        resp = client.put("/api/ratings", json={"item_id": ZERO_UUID})
        assert resp.status_code == 400

    @pytest.mark.smoke
    def test_missing_score_returns_400(self, client):
        # item_id + author present but no numeric score anywhere → "Missing score".
        resp = client.put("/api/ratings", json={"item_id": ZERO_UUID, "author": "pytest"})
        assert resp.status_code == 400


@allure.feature("Ratings")
@allure.story("Auth Enforcement")
class TestRatingsAuthEnforcement:

    @pytest.mark.xfail(
        strict=True,
        reason=(
            "SECURITY GAP: PUT /api/ratings has no isAdminRequest() guard, so any "
            "anonymous caller can upsert/overwrite scores. The bogus item_id FK "
            "violation keeps this non-destructive (reaches the DB → 500, no row). "
            "When a guard is added this flips to xpass — remove the marker and "
            "assert 403."
        ),
    )
    def test_rating_write_should_require_auth(self, client):
        resp = client.put(
            "/api/ratings",
            json={"item_id": ZERO_UUID, "author": "pytest", "score": 5},
        )
        assert resp.status_code in (401, 403)
