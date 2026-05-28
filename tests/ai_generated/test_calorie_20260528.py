"""API tests for calorie endpoints."""

import allure
import httpx
import pytest


@allure.feature("Calorie")
@allure.story("Authentication")
class TestCalorieAuth:

    @pytest.mark.smoke
    def test_delete_meal_unauthorized_returns_401_or_403(self, client):
        resp = client.delete("/api/calorie/meals/00000000-0000-0000-0000-000000000000")
        assert resp.status_code in (401, 403)

    def test_commit_run_unauthorized_returns_401_or_403(self, client):
        resp = client.post("/api/calorie/runs/00000000-0000-0000-0000-000000000000/commit", json={})
        assert resp.status_code in (401, 403)

    def test_discard_run_unauthorized_returns_401_or_403(self, client):
        resp = client.post("/api/calorie/runs/00000000-0000-0000-0000-000000000000/discard")
        assert resp.status_code in (401, 403)


@allure.feature("Calorie")
@allure.story("Meals")
class TestCalorieMeals:

    @pytest.mark.smoke
    @pytest.mark.admin
    def test_delete_nonexistent_meal_returns_404(self, admin_client):
        resp = admin_client.delete("/api/calorie/meals/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


@allure.feature("Calorie")
@allure.story("Runs")
class TestCalorieRuns:

    @pytest.mark.smoke
    @pytest.mark.admin
    def test_commit_nonexistent_run_returns_404(self, admin_client):
        resp = admin_client.post("/api/calorie/runs/00000000-0000-0000-0000-000000000000/commit", json={})
        assert resp.status_code == 404

    @pytest.mark.admin
    def test_commit_invalid_payload_returns_400(self, admin_client):
        resp = admin_client.post(
            "/api/calorie/runs/00000000-0000-0000-0000-000000000000/commit",
            json={"editedPayload": {"invalid": "payload"}}
        )
        assert resp.status_code == 400

    @pytest.mark.admin
    def test_discard_nonexistent_run_returns_404(self, admin_client):
        resp = admin_client.post("/api/calorie/runs/00000000-0000-0000-0000-000000000000/discard")
        assert resp.status_code == 404
