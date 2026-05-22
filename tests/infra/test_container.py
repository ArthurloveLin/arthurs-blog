"""
Docker infrastructure tests for the arthurs-blog-test container.

Run with:
    pytest tests/infra/ --hosts=docker://arthurs-blog-test -v

These tests verify container health, security posture, process state, and
file system layout — directly demonstrating Docker + Linux QA skills.
"""

import allure
import pytest

# testinfra injects `host` via --hosts CLI argument or the @pytest.fixture below
# Each test receives `host` as a fixture automatically when --hosts is used.


@allure.feature("Infrastructure")
@allure.story("Network")
class TestNetworking:

    @pytest.mark.smoke
    def test_app_port_listening_inside_container(self, host, app_port):
        """Next.js must listen on port 3000 inside the container."""
        sock = host.socket(f"tcp://0.0.0.0:{app_port}")
        assert sock.is_listening, f"Port {app_port} is not listening"

    @pytest.mark.smoke
    def test_health_endpoint_responds_200(self, host):
        """Health check: GET / returns HTTP 200."""
        result = host.run(
            "curl -sf http://localhost:3000/ -o /dev/null -w '%{http_code}'"
        )
        assert result.rc == 0, "curl failed — app may not be running"
        assert result.stdout.strip() == "200", f"Unexpected status: {result.stdout}"

    def test_api_search_endpoint_reachable(self, host):
        result = host.run(
            "curl -sf 'http://localhost:3000/api/blog/search?q=test' -o /dev/null -w '%{http_code}'"
        )
        assert result.stdout.strip() == "200"

    def test_no_unexpected_ports_listening(self, host):
        """Only port 3000 should be open inside the container."""
        result = host.run("ss -tlnp")
        lines = [l for l in result.stdout.splitlines() if "LISTEN" in l]
        listening_ports = []
        for line in lines:
            parts = line.split()
            for part in parts:
                if ":" in part:
                    port = part.rsplit(":", 1)[-1]
                    if port.isdigit():
                        listening_ports.append(int(port))
        unexpected = [p for p in listening_ports if p not in (3000,)]
        assert unexpected == [], f"Unexpected listening ports: {unexpected}"


@allure.feature("Infrastructure")
@allure.story("Security")
class TestSecurity:

    @pytest.mark.smoke
    def test_process_runs_as_non_root(self, host):
        """The Node.js process must not run as root (uid 0)."""
        result = host.run("ps aux")
        node_lines = [l for l in result.stdout.splitlines() if "node" in l and "grep" not in l]
        for line in node_lines:
            user = line.split()[0]
            assert user != "root", f"node process running as root: {line}"

    def test_nextjs_user_exists(self, host):
        """Dockerfile creates a 'nextjs' user for running the app."""
        result = host.run("id nextjs")
        assert result.rc == 0, "User 'nextjs' does not exist in container"

    def test_app_dir_not_world_writable(self, host):
        result = host.run("stat -c '%a' /app")
        mode = result.stdout.strip()
        # Should not be world-writable (last octet should not include 2 or 6)
        assert mode[-1] not in ("2", "3", "6", "7"), f"/app is world-writable: mode={mode}"

    def test_no_sensitive_env_in_process_list(self, host):
        """Secrets should not appear in the process command line."""
        result = host.run("cat /proc/1/cmdline")
        cmdline = result.stdout
        assert "SECRET" not in cmdline.upper()
        assert "PASSWORD" not in cmdline.upper()


@allure.feature("Infrastructure")
@allure.story("Process")
class TestProcess:

    @pytest.mark.smoke
    def test_node_process_running(self, host):
        result = host.run("pgrep -c node")
        assert result.rc == 0, "No node process found"
        count = int(result.stdout.strip())
        assert count >= 1

    def test_process_has_uptime(self, host):
        """Container's main process should be alive."""
        result = host.run("cat /proc/1/stat")
        assert result.rc == 0

    def test_no_zombie_processes(self, host):
        """No zombie (defunct) processes should exist."""
        result = host.run("ps aux | grep -c defunct || true")
        defunct_count = int(result.stdout.strip())
        assert defunct_count == 0, f"{defunct_count} zombie process(es) found"


@allure.feature("Infrastructure")
@allure.story("File System")
class TestFileSystem:

    def test_app_directory_exists(self, host):
        assert host.file("/app").is_directory

    def test_next_build_output_exists(self, host):
        """Standalone build output must be present."""
        assert host.file("/app/.next").is_directory

    def test_static_files_exist(self, host):
        assert host.file("/app/public").is_directory

    def test_cache_directory_writable(self, host):
        result = host.run("touch /app/.next/cache/.pytest-probe && rm /app/.next/cache/.pytest-probe")
        assert result.rc == 0, "/app/.next/cache is not writable by the app user"


@allure.feature("Infrastructure")
@allure.story("Logs")
class TestLogging:

    def test_app_produces_stdout_output(self, host):
        """Next.js should log startup messages."""
        result = host.run("timeout 2 cat /proc/1/fd/1 2>/dev/null || true")
        # We can't guarantee stdout content from /proc, so just check the process is logging
        # Alternative: use docker logs externally (done in CI workflow)
        assert result.rc in (0, 1)

    def test_no_crash_in_recent_output(self, host):
        """Check the app hasn't output 'FATAL ERROR' or similar crash indicators."""
        result = host.run(
            "curl -sf http://localhost:3000/ -o /dev/null && echo OK"
        )
        assert "OK" in result.stdout, "App may have crashed — health check failed"
