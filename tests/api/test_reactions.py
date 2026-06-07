# tested-source: app/api/posts/[id]/reaction/route.ts
# tested-source: app/api/posts/[id]/emoji/route.ts
# tested-source: app/api/comments/[id]/reaction/route.ts
# tested-source: app/api/comments/[id]/emoji/route.ts
"""
API tests for the anonymous reaction / emoji endpoints (posts + comments).

These are public, identity-gated writes. The comment routes verify the comment
exists before writing, so a bogus comment id → 404 with no mutation; the
identity/emoji validation returns 400 before any DB access. Post routes are
covered only for the safe missing-identity 400 (their write path may upsert
engagement counts). The happy path is deferred — it mutates shared rows.
"""

import allure
import pytest

ZERO_UUID = "00000000-0000-0000-0000-000000000000"


@allure.feature("Reactions")
@allure.story("Identity Validation")
class TestReactionIdentity:

    @pytest.mark.smoke
    @pytest.mark.parametrize("path", [
        "/api/posts/{id}/reaction",
        "/api/posts/{id}/emoji",
        "/api/comments/{id}/reaction",
        "/api/comments/{id}/emoji",
    ])
    def test_missing_identity_returns_400(self, client, path):
        resp = client.post(path.format(id=ZERO_UUID), json={})
        assert resp.status_code == 400


@allure.feature("Reactions")
@allure.story("Comment Reactions")
class TestCommentReactions:

    def test_unknown_comment_reaction_returns_404(self, client):
        # applyCommentReaction looks up the comment first → bogus id → 404, no write.
        resp = client.post(
            f"/api/comments/{ZERO_UUID}/reaction",
            json={"identity": "pytest-visitor", "reaction": 1},
        )
        assert resp.status_code == 404

    def test_invalid_emoji_returns_400(self, client):
        # No emoji → normalizeEmoji(null) → INVALID_EMOJI, before the comment lookup.
        resp = client.post(
            f"/api/comments/{ZERO_UUID}/emoji",
            json={"identity": "pytest-visitor"},
        )
        assert resp.status_code == 400

    def test_unknown_comment_emoji_returns_404(self, client):
        resp = client.post(
            f"/api/comments/{ZERO_UUID}/emoji",
            json={"identity": "pytest-visitor", "emoji": "👍"},
        )
        assert resp.status_code == 404
