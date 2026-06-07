"""
API tests for PUT /api/ratings.

This is a PUBLIC anonymous voting endpoint (session-share MultiDimRating, author
is a self-declared name) — intentionally not auth-gated. The author-spoofing risk
is inherent to anonymous voting; instead the route is hardened to reject
malformed input at the app layer (400) rather than reaching the DB (500) or
polluting the scores jsonb. The rating scale is 1–5.

All cases below are validation-only (400 before any DB write), so non-destructive.
Deferred (needs a seeded item + cleanup): the happy upsert + onConflict idempotency.
"""

import allure
import pytest

ZERO_UUID = "00000000-0000-0000-0000-000000000000"


@allure.feature("Ratings")
@allure.story("Validation")
class TestRatingsValidation:

    def test_missing_item_id_returns_400(self, client):
        assert client.put("/api/ratings", json={"author": "pytest"}).status_code == 400

    def test_non_string_item_id_returns_400(self, client):
        assert client.put("/api/ratings", json={"item_id": 123, "author": "p"}).status_code == 400

    def test_missing_author_returns_400(self, client):
        assert client.put("/api/ratings", json={"item_id": ZERO_UUID}).status_code == 400

    @pytest.mark.smoke
    def test_missing_score_returns_400(self, client):
        # item_id + author present but no numeric score anywhere → "Missing score".
        resp = client.put("/api/ratings", json={"item_id": ZERO_UUID, "author": "pytest"})
        assert resp.status_code == 400


@allure.feature("Ratings")
@allure.story("Input Hardening")
class TestRatingsHardening:
    """The endpoint is public by design; these guard against garbage/abuse."""

    @pytest.mark.smoke
    def test_out_of_range_score_returns_400(self, client):
        # 99 is outside the 1–5 scale → rejected at the app layer (was a 500 / bad row).
        resp = client.put(
            "/api/ratings",
            json={"item_id": ZERO_UUID, "author": "pytest", "appearance_score": 99},
        )
        assert resp.status_code == 400

    def test_below_range_score_returns_400(self, client):
        resp = client.put(
            "/api/ratings",
            json={"item_id": ZERO_UUID, "author": "pytest", "appearance_score": 0},
        )
        assert resp.status_code == 400

    def test_author_too_long_returns_400(self, client):
        resp = client.put(
            "/api/ratings",
            json={"item_id": ZERO_UUID, "author": "a" * 100, "appearance_score": 3},
        )
        assert resp.status_code == 400
