"""API tests for the /api/agents endpoint."""

import allure
import httpx
import pytest


@allure.feature("Agents")
@allure.story("Runtime Health")
class TestAgentsHealth:

    @pytest.mark.smoke
    def test_health_unauthorized(self, client):
        resp = client.get("/api/agents/runtime/health")
        assert resp.status_code == 403

    @pytest.mark.admin
    @pytest.mark.smoke
    def test_health_authorized(self, admin_client):
        resp = admin_client.get("/api/agents/runtime/health")
        assert resp.status_code in (200, 503)
        data = resp.json()
        assert "status" in data
        assert data["status"] in ("ok", "degraded")
        assert "checkedAt" in data
        assert "runtime" in data
        assert "health" in data
        assert "no-store" in resp.headers.get("Cache-Control", "")


@allure.feature("Agents")
@allure.story("Runs")
class TestAgentsRuns:

    @pytest.mark.smoke
    def test_list_runs_unauthorized(self, client):
        resp = client.get("/api/agents/runs")
        assert resp.status_code in (401, 403)

    @pytest.mark.admin
    @pytest.mark.smoke
    def test_list_runs_authorized(self, admin_client):
        resp = admin_client.get("/api/agents/runs")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.admin
    def test_list_runs_invalid_limit(self, admin_client):
        resp = admin_client.get("/api/agents/runs", params={"limit": -5})
        assert resp.status_code == 400

    def test_execute_run_unauthorized(self, client):
        resp = client.post("/api/agents/runs", json={"threadId": "test"})
        assert resp.status_code in (401, 403)

    @pytest.mark.admin
    def test_execute_run_validation(self, admin_client):
        resp = admin_client.post("/api/agents/runs", json={})
        assert resp.status_code == 400


@allure.feature("Agents")
@allure.story("Run Detail")
class TestAgentsRunDetail:

    @pytest.mark.smoke
    def test_get_run_unauthorized(self, client):
        resp = client.get("/api/agents/runs/00000000-0000-0000-0000-000000000000")
        assert resp.status_code in (401, 403)

    @pytest.mark.admin
    @pytest.mark.smoke
    def test_get_run_not_found(self, admin_client):
        resp = admin_client.get("/api/agents/runs/00000000-0000-0000-0000-000000000000")
        assert resp.status_code in (404, 500)

    def test_retry_run_unauthorized(self, client):
        resp = client.post("/api/agents/runs/00000000-0000-0000-0000-000000000000", json={"action": "retry"})
        assert resp.status_code in (401, 403)

    @pytest.mark.admin
    def test_retry_run_invalid_action(self, admin_client):
        resp = admin_client.post("/api/agents/runs/00000000-0000-0000-0000-000000000000", json={"action": "invalid"})
        assert resp.status_code == 400

    @pytest.mark.admin
    def test_retry_run_not_found(self, admin_client):
        resp = admin_client.post("/api/agents/runs/00000000-0000-0000-0000-000000000000", json={"action": "retry"})
        assert resp.status_code in (404, 500)


@allure.feature("Agents")
@allure.story("Attachments")
class TestAgentsAttachments:

    @pytest.mark.smoke
    def test_get_attachments_unauthorized(self, client):
        resp = client.get("/api/agents/threads/00000000-0000-0000-0000-000000000000/attachments")
        assert resp.status_code in (401, 403)

    @pytest.mark.admin
    @pytest.mark.smoke
    def test_get_attachments_not_found(self, admin_client):
        resp = admin_client.get("/api/agents/threads/00000000-0000-0000-0000-000000000000/attachments")
        assert resp.status_code in (404, 500)

    def test_register_attachment_unauthorized(self, client):
        resp = client.post("/api/agents/threads/00000000-0000-0000-0000-000000000000/attachments", json={})
        assert resp.status_code in (401, 403)

    @pytest.mark.admin
    def test_register_attachment_validation(self, admin_client):
        resp = admin_client.post("/api/agents/threads/00000000-0000-0000-0000-000000000000/attachments", json={})
        assert resp.status_code == 400
