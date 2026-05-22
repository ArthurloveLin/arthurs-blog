"""
API tests for /api/recipes/* endpoints.

Endpoints covered:
  GET  /api/recipes                         (public: published only; admin: all)
  POST /api/recipes                         (admin only)
  GET  /api/recipes/[slug]                  (public/admin)
  PATCH /api/recipes/[slug]                 (admin only)
  DELETE /api/recipes/[slug]                (admin only)
  GET  /api/recipes/[slug]/revisions        (admin only)
  GET  /api/recipes/prerequisites            (public)
  POST /api/recipes/prerequisites            (admin)
  DELETE /api/recipes/prerequisites/[id]    (admin)
"""

import uuid

import allure
import pytest

TEST_SLUG_PREFIX = "pytest-test-recipe"


@allure.feature("Recipes")
@allure.story("List")
class TestRecipeList:

    @pytest.mark.smoke
    def test_list_returns_array(self, client):
        resp = client.get("/api/recipes")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_items_have_required_fields(self, client):
        data = client.get("/api/recipes").json()
        for recipe in data:
            assert "slug" in recipe
            assert "title" in recipe

    def test_list_only_published_for_public(self, client):
        data = client.get("/api/recipes").json()
        for recipe in data:
            assert recipe.get("published") is True

    @pytest.mark.admin
    def test_admin_sees_all_recipes(self, admin_client, client):
        public_count = len(client.get("/api/recipes").json())
        admin_count = len(admin_client.get("/api/recipes").json())
        assert admin_count >= public_count


@allure.feature("Recipes")
@allure.story("CRUD")
class TestRecipeCRUD:

    @pytest.fixture
    def test_slug(self) -> str:
        return f"{TEST_SLUG_PREFIX}-{uuid.uuid4().hex[:8]}"

    @pytest.fixture
    def created_recipe(self, admin_client, test_slug):
        """Create a recipe and delete it after the test."""
        resp = admin_client.post("/api/recipes", json={
            "title": "Test Recipe",
            "slug": test_slug,
            "published": False,
        })
        assert resp.status_code == 201, f"Create failed: {resp.text}"
        recipe = resp.json()
        yield recipe
        # Cleanup
        admin_client.delete(f"/api/recipes/{test_slug}")

    @pytest.mark.admin
    @pytest.mark.write
    def test_create_recipe(self, admin_client, test_slug):
        resp = admin_client.post("/api/recipes", json={
            "title": "Pytest Created Recipe",
            "slug": test_slug,
            "published": False,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["slug"] == test_slug
        assert data["title"] == "Pytest Created Recipe"
        # Cleanup
        admin_client.delete(f"/api/recipes/{test_slug}")

    @pytest.mark.admin
    @pytest.mark.write
    def test_create_duplicate_slug_returns_409(self, admin_client, created_recipe):
        resp = admin_client.post("/api/recipes", json={
            "title": "Duplicate",
            "slug": created_recipe["slug"],
        })
        assert resp.status_code == 409

    @pytest.mark.admin
    @pytest.mark.write
    def test_create_missing_title_returns_400(self, admin_client, test_slug):
        resp = admin_client.post("/api/recipes", json={"slug": test_slug})
        assert resp.status_code == 400

    @pytest.mark.admin
    @pytest.mark.write
    def test_get_recipe_by_slug(self, admin_client, created_recipe):
        slug = created_recipe["slug"]
        resp = admin_client.get(f"/api/recipes/{slug}")
        assert resp.status_code == 200
        assert resp.json()["slug"] == slug

    @pytest.mark.admin
    @pytest.mark.write
    def test_patch_recipe(self, admin_client, created_recipe):
        slug = created_recipe["slug"]
        resp = admin_client.patch(f"/api/recipes/{slug}", json={"title": "Updated Title"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"

    @pytest.mark.admin
    @pytest.mark.write
    def test_delete_recipe(self, admin_client, test_slug):
        admin_client.post("/api/recipes", json={"title": "To Delete", "slug": test_slug, "published": False})
        resp = admin_client.delete(f"/api/recipes/{test_slug}")
        assert resp.status_code in (200, 204)
        # Verify gone
        get_resp = admin_client.get(f"/api/recipes/{test_slug}")
        assert get_resp.status_code == 404

    def test_get_nonexistent_recipe_returns_404(self, client):
        resp = client.get("/api/recipes/this-slug-does-not-exist-abc123")
        assert resp.status_code == 404

    @pytest.mark.admin
    def test_create_requires_admin(self, client):
        resp = client.post("/api/recipes", json={"title": "X", "slug": "x"})
        assert resp.status_code in (401, 403)


@allure.feature("Recipes")
@allure.story("Prerequisites")
class TestRecipePrerequisites:

    def test_list_prerequisites_public(self, client):
        resp = client.get("/api/recipes/prerequisites")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
