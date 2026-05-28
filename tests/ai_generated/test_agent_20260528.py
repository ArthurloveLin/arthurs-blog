"""API tests for agent endpoints."""

import allure
import httpx
import pytest


@allure.feature("Agent")
@allure.story("Authentication")
class TestAgentAuth:

    @pytest.mark.smoke
    def test_runs_list_unauthorized_returns_401_or_403(self, client):
        resp = client.get("/api/agents/runs")
        assert resp.status_code in (401, 403)

    def test_threads_list_unauthorized_returns_401_or_403(self, client):
        resp = client.get("/api/agents/threads")
        assert resp.status_code in (401, 403)


@allure.feature("Agent")
@allure.story("Runs")
class TestAgentRuns:

    @pytest.mark.smoke
    @pytest.mark.admin
    def test_runs_list_returns_200(self, admin_client):
        resp = admin_client.get("/api/agents/runs")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.admin
    def test_get_nonexistent_run_returns_404(self, admin_client):
        resp = admin_client.get("/api/agents/runs/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404


@allure.feature("Agent")
@allure.story("Threads")
class TestAgentThreads:

    @pytest.mark.smoke
    @pytest.mark.admin
    def test_threads_list_returns_200(self, admin_client):
        resp = admin_client.get("/api/agents/threads")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.admin
    def test_create_thread_missing_keys_returns_400(self, admin_client):
        resp = admin_client.post("/api/agents/threads", json={"title": "Test"})
        assert resp.status_code == 400

    @pytest.mark.admin
    def test_get_nonexistent_thread_returns_404(self, admin_client):
        resp = admin_client.get("/api/agents/threads/00000000-0000-0000-0000-000000000000")
        assert resp.status_code == 404

    @pytest.mark.admin
    def test_get_nonexistent_thread_messages_returns_404(self, admin_client):
        resp = admin_client.get("/api/agents/threads/00000000-0000-0000-0000-000000000000/messages")
        assert resp.status_code == 404

    @pytest.mark.admin
    def test_post_message_to_nonexistent_thread_returns_404(self, admin_client):
        resp = admin_client.post(
            "/api/agents/threads/00000000-0000-0000-0000-000000000000/messages",
            json={"textContent": "hello"}
        )
        assert resp.status_code == 404
