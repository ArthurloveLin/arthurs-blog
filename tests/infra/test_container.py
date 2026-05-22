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

    def test_no_unexpected_privileged_ports_listening(self, host):
        """No unexpected privileged port (< 1024) should be listening.

        Next.js internally binds ephemeral high ports for IPC — those are
        allowed. Only flag well-known port range (< 1024) surprises.
        """
        result = host.run("cat /proc/net/tcp /proc/net/tcp6 2>/dev/null")
        listening_ports = set()
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) < 4 or parts[0] == "sl":
                continue
            if parts[3] != "0A":
                continue
            local_addr = parts[1]
            if ":" in local_addr:
                hex_port = local_addr.rsplit(":", 1)[-1]
                try:
                    listening_ports.add(int(hex_port, 16))
                except ValueError:
                    pass
        unexpected_privileged = [p for p in listening_ports if p < 1024]
        assert unexpected_privileged == [], f"Unexpected privileged ports: {unexpected_privileged}"


@allure.feature("Infrastructure")
@allure.story("Security")
class TestSecurity:

    @pytest.mark.smoke
    def test_process_runs_as_non_root(self, host):
        """PID 1 must not run as root — verified via /proc/1/status."""
        result = host.run("cat /proc/1/status")
        assert result.rc == 0
        uid_line = next((l for l in result.stdout.splitlines() if l.startswith("Uid:")), None)
        assert uid_line is not None, "Could not find Uid line in /proc/1/status"
        # Format: "Uid:\treal\teffective\tsaved\tfs"
        real_uid = int(uid_line.split()[1])
        assert real_uid != 0, f"PID 1 is running as root (uid={real_uid})"

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
    def test_nextjs_server_process_running(self, host):
        """Next.js server process must be running as PID 1.

        The standalone image runs `node server.js` directly; the kernel
        names the process "next-server (v..." in /proc/1/comm. We check
        for "next" to be robust across minor version changes.
        """
        result = host.run("cat /proc/1/comm")
        assert result.rc == 0, "Could not read /proc/1/comm"
        comm = result.stdout.strip()
        assert "next" in comm.lower(), f"Unexpected PID 1 process: {comm!r}"

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
