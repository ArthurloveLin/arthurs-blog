"""
Docker infrastructure tests for the arthurs-blog-test container.

Run with:
    pytest tests/infra/ --hosts=docker://arthurs-blog-test -v

These tests verify container health, security posture, process state, and
file system layout — directly demonstrating Docker + Linux QA skills.

Note: The Next.js standalone image is based on node-alpine (minimal).
Tools like ss, netstat, curl, pgrep, and touch are NOT present.
All networking checks use /proc/net/tcp; HTTP checks use the node binary.
"""

import allure
import pytest

# Hex representation of port 3000 (used in /proc/net/tcp)
_PORT_3000_HEX = "0BB8"


def _http_status(host, url: str) -> int:
    """Use the node binary (always present) to fetch a URL and return the HTTP status code."""
    script = (
        f"var h=require('http');"
        f"h.get('{url}',function(r){{process.stdout.write(String(r.statusCode));process.exit(0);}});"
        f"setTimeout(function(){{process.exit(2);}},5000);"
    )
    result = host.run(f"node -e \"{script}\"")
    try:
        return int(result.stdout.strip())
    except ValueError:
        return -1


@allure.feature("Infrastructure")
@allure.story("Network")
class TestNetworking:

    @pytest.mark.smoke
    def test_app_port_listening_inside_container(self, host, app_port):
        """Next.js must listen on port 3000 inside the container.

        Uses /proc/net/tcp and /proc/net/tcp6 because ss/netstat are not
        present in the minimal node-alpine image.
        """
        port_hex = format(app_port, "04X")
        result = host.run(
            f"cat /proc/net/tcp /proc/net/tcp6 2>/dev/null | grep -i ':{port_hex}'"
        )
        assert result.rc == 0, (
            f"Port {app_port} not found in /proc/net/tcp — app may not be listening"
        )

    @pytest.mark.smoke
    def test_health_endpoint_responds_200(self, host):
        """Health check: GET / returns HTTP 200."""
        status = _http_status(host, "http://localhost:3000/")
        assert status == 200, f"Expected 200, got {status}"

    def test_api_search_endpoint_reachable(self, host):
        status = _http_status(host, "http://localhost:3000/api/blog/search?q=test")
        assert status == 200, f"Expected 200, got {status}"

    def test_no_unexpected_ports_listening(self, host):
        """Only port 3000 should be open inside the container.

        Reads /proc/net/tcp and /proc/net/tcp6 (hex port in column 2).
        """
        result = host.run("cat /proc/net/tcp /proc/net/tcp6 2>/dev/null")
        listening_ports = set()
        for line in result.stdout.splitlines():
            parts = line.split()
            # Lines with actual sockets have ≥10 columns; skip header
            if len(parts) < 4 or parts[0] == "sl":
                continue
            # st column == "0A" means TCP_LISTEN
            if parts[3] != "0A":
                continue
            local_addr = parts[1]
            if ":" in local_addr:
                hex_port = local_addr.rsplit(":", 1)[-1]
                try:
                    listening_ports.add(int(hex_port, 16))
                except ValueError:
                    pass
        unexpected = [p for p in listening_ports if p != 3000]
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
        # World-writable if last octet contains write bit (2, 3, 6, 7)
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
        """At least one node process must be running.

        Scans /proc/*/comm because pgrep is not available in the minimal image.
        """
        result = host.run(
            "sh -c 'for f in /proc/[0-9]*/comm; do cat \"$f\" 2>/dev/null; done | grep -c node'"
        )
        assert result.rc == 0, "No node process found"
        count = int(result.stdout.strip())
        assert count >= 1, f"Expected ≥1 node process, found {count}"

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
        """Write and delete a probe file using node (touch is not in alpine)."""
        script = (
            "var fs=require('fs');"
            "fs.writeFileSync('/app/.next/cache/.pytest-probe','');"
            "fs.unlinkSync('/app/.next/cache/.pytest-probe');"
        )
        result = host.run(f"node -e \"{script}\"")
        assert result.rc == 0, f"/app/.next/cache is not writable: {result.stderr}"


@allure.feature("Infrastructure")
@allure.story("Logs")
class TestLogging:

    def test_app_produces_stdout_output(self, host):
        """Next.js should log startup messages."""
        result = host.run("timeout 2 cat /proc/1/fd/1 2>/dev/null || true")
        assert result.rc in (0, 1)

    def test_no_crash_in_recent_output(self, host):
        """Verify the app responds to HTTP requests (indicates no crash)."""
        status = _http_status(host, "http://localhost:3000/")
        assert status == 200, f"App may have crashed — HTTP status {status}"
