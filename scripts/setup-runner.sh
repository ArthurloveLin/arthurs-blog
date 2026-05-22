#!/usr/bin/env bash
# setup-runner.sh — Install GitHub Actions self-hosted runner on the VPS.
#
# Usage:
#   bash scripts/setup-runner.sh
#
# Prerequisites:
#   1. Get a registration token from:
#      GitHub repo → Settings → Actions → Runners → New self-hosted runner
#   2. Set RUNNER_TOKEN env var before running this script:
#      export RUNNER_TOKEN=<token-from-github>
#   3. Run as the user who owns /home/arthur (not root).
#
# What this script does:
#   - Downloads the latest Actions runner binary
#   - Configures it with labels: self-hosted, linux, vps
#   - Installs it as a systemd service (auto-start on reboot)
#
# After running:
#   - Check status: sudo systemctl status actions.runner.*
#   - View logs:    sudo journalctl -u actions.runner.* -f

set -euo pipefail

REPO_URL="https://github.com/ArthurloveLin/arthurs-blog"
RUNNER_VERSION="2.319.1"   # Update to latest from github.com/actions/runner/releases
RUNNER_DIR="$HOME/actions-runner"

if [ -z "${RUNNER_TOKEN:-}" ]; then
    echo "ERROR: Set RUNNER_TOKEN before running this script."
    echo "  Get it from: GitHub repo → Settings → Actions → Runners → New self-hosted runner"
    exit 1
fi

echo "=== Creating runner directory ==="
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

echo "=== Detecting architecture ==="
ARCH=$(uname -m)
case $ARCH in
    x86_64) RUNNER_ARCH="x64" ;;
    aarch64) RUNNER_ARCH="arm64" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

TARBALL="actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
DOWNLOAD_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${TARBALL}"

if [ ! -f "$TARBALL" ]; then
    echo "=== Downloading runner v${RUNNER_VERSION} (${RUNNER_ARCH}) ==="
    curl -O -L "$DOWNLOAD_URL"
else
    echo "=== Tarball already downloaded, skipping ==="
fi

echo "=== Extracting runner ==="
tar xzf "./${TARBALL}"

echo "=== Configuring runner ==="
./config.sh \
    --url "$REPO_URL" \
    --token "$RUNNER_TOKEN" \
    --name "vps-runner-$(hostname)" \
    --labels "self-hosted,linux,vps" \
    --work "$HOME/_work" \
    --unattended

echo "=== Installing as systemd service ==="
sudo ./svc.sh install
sudo ./svc.sh start

echo ""
echo "✅ Runner installed and started."
echo ""
echo "Useful commands:"
echo "  Status:  sudo systemctl status actions.runner.*"
echo "  Logs:    sudo journalctl -u actions.runner.* -f"
echo "  Stop:    sudo ./svc.sh stop    (from $RUNNER_DIR)"
echo "  Remove:  sudo ./svc.sh uninstall && ./config.sh remove --token <token>"
echo ""
echo "Verify in GitHub: repo → Settings → Actions → Runners"
echo "The runner should show as 'Idle' within 30 seconds."
