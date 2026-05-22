#!/usr/bin/env bash
# test-local.sh — debug tool for validating the test pipeline itself.
#
# Intended use: run by Claude when modifying CI/test infrastructure to verify
# changes before committing. Not a mandatory pre-push gate — CI is the
# authoritative test gate.
#
# Usage:
#   ./scripts/test-local.sh            # run tests, keep container running
#   ./scripts/test-local.sh --teardown # run tests, stop container at the end
#
# Prerequisites:
#   - .env.test.local present at repo root (see tests/.env.test.example)
#   - Docker running
#   - pip install -r tests/requirements.txt

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

TEARDOWN=false
[[ "${1:-}" == "--teardown" ]] && TEARDOWN=true

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass() { echo -e "${GREEN}✅ $*${NC}"; }
fail() { echo -e "${RED}❌ $*${NC}"; }
info() { echo -e "${YELLOW}▶ $*${NC}"; }

FAILED=0

# ── 1. Start test container ────────────────────────────────────────────────────
info "Starting test container (port 3020)..."
if ! [ -f .env.test.local ]; then
  fail ".env.test.local not found. Copy tests/.env.test.example and fill in values."
  exit 1
fi

docker compose -f tests/docker-compose.test.yml up -d 2>/dev/null

info "Waiting for container health check..."
for i in $(seq 1 18); do
  if curl -sf http://localhost:3020/api/blog/search?q=test -o /dev/null 2>/dev/null; then
    pass "Container healthy (${i}0s)"
    break
  fi
  if [ "$i" -eq 18 ]; then
    fail "Container failed to become healthy after 180s"
    docker logs arthurs-blog-test --tail 30
    exit 1
  fi
  echo "  waiting... $i/18"
  sleep 10
done

# ── 2. Infra tests ─────────────────────────────────────────────────────────────
info "Running infra tests..."
if pytest tests/infra/ \
    --hosts=docker://arthurs-blog-test \
    --timeout=30 \
    -q 2>&1; then
  pass "Infra tests passed"
else
  fail "Infra tests FAILED"
  FAILED=$((FAILED + 1))
fi

# ── 3. API tests ───────────────────────────────────────────────────────────────
info "Running API tests..."
if TEST_BASE_URL=http://localhost:3020 \
   pytest tests/api/ \
    --timeout=30 \
    -m "not slow" \
    -q 2>&1; then
  pass "API tests passed"
else
  fail "API tests FAILED"
  FAILED=$((FAILED + 1))
fi

# ── 4. Teardown ────────────────────────────────────────────────────────────────
if $TEARDOWN; then
  info "Stopping test container..."
  docker compose -f tests/docker-compose.test.yml down --remove-orphans 2>/dev/null
  pass "Container stopped"
else
  info "Container left running (port 3020). Stop with:"
  echo "  docker compose -f tests/docker-compose.test.yml down"
fi

# ── 5. Summary ─────────────────────────────────────────────────────────────────
echo ""
if [ "$FAILED" -eq 0 ]; then
  pass "All local checks passed."
  exit 0
else
  fail "$FAILED test suite(s) failed."
  exit 1
fi
