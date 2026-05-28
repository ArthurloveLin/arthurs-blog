"""API tests for agent executor runtime."""

import allure
import httpx
import pytest


@allure.feature("Executor")
@allure.story("Authentication")
class TestExecutorAuth:

    @pytest.mark.smoke
    def test_runtime_health_unauthorized_returns_401_or_403(self, client):
        resp = client.get("/api/agents/runtime/health")
        assert resp.status_code in (401, 403)

    def test_runs_post_unauthorized_returns_401_or_403(self, client):
        resp = client.post("/api/agents/runs", json={})
        assert resp.status_code in (401, 403)


@allure.feature("Executor")
@allure.story("Runtime Health")
class TestExecutorRuntimeHealth:

    @pytest.mark.smoke
    @pytest.mark.admin
    def test_runtime_health_returns_200_or_503(self, admin_client):
        resp = admin_client.get("/api/agents/runtime/health")
        assert resp.status_code in (200, 503)
        data = resp.json()
        assert "status" in data
        assert data["status"] in ("ok", "degraded")
        assert "health" in data
        assert "checks" in data["health"]


@allure.feature("Executor")
@allure.story("Runs Execution")
class TestExecutorRunsExecution:

    @pytest.mark.smoke
    @pytest.mark.admin
    def test_runs_post_invalid_body_returns_400(self, admin_client):
        resp = admin_client.post("/api/agents/runs", json={})
        assert resp.status_code == 400
