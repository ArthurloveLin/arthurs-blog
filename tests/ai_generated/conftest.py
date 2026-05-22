"""
Fixtures for AI-generated tests in tests/ai_generated/.

Self-contained mirror of tests/api/conftest.py — kept separate so AI-generated
test files have an independent fixture scope and do not pull in api/ test state.

Env vars (loaded from .env.test.local or CI environment):
  TEST_BASE_URL              — base URL of the running test container
  NEXT_PUBLIC_SUPABASE_URL   — Supabase project URL (for admin auth)
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  TEST_ADMIN_EMAIL
  TEST_ADMIN_PASSWORD
"""

import base64
import json
import os
from urllib.parse import urlparse

import httpx
import pytest
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env.test.local"), override=False)

TEST_BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:3020")
TEST_SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
TEST_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
TEST_ADMIN_EMAIL = os.getenv("TEST_ADMIN_EMAIL", "")
TEST_ADMIN_PASSWORD = os.getenv("TEST_ADMIN_PASSWORD", "")


def _supabase_storage_key(supabase_url: str) -> str:
    # Mirror JS SDK: `sb-${new URL(url).hostname.split(".")[0]}-auth-token`
    hostname = urlparse(supabase_url).hostname or ""
    ref = hostname.split(".")[0]
    return f"sb-{ref}-auth-token"


@pytest.fixture(scope="session")
def base_url() -> str:
    return TEST_BASE_URL


@pytest.fixture(scope="session")
def client(base_url) -> httpx.Client:
    """Unauthenticated httpx client for public endpoint tests."""
    with httpx.Client(base_url=base_url, timeout=30.0, follow_redirects=True) as c:
        yield c


@pytest.fixture(scope="session")
def admin_session_cookie() -> dict[str, str]:
    if not TEST_ADMIN_EMAIL or not TEST_ADMIN_PASSWORD or not TEST_SUPABASE_URL:
        pytest.skip("Admin credentials not configured (TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD)")

    resp = httpx.post(
        f"{TEST_SUPABASE_URL}/auth/v1/token?grant_type=password",
        json={"email": TEST_ADMIN_EMAIL, "password": TEST_ADMIN_PASSWORD},
        headers={"apikey": TEST_ANON_KEY, "Content-Type": "application/json"},
        timeout=15.0,
    )
    assert resp.status_code == 200, f"Admin sign-in failed: {resp.text}"
    session = resp.json()

    cookie_name = _supabase_storage_key(TEST_SUPABASE_URL)

    # @supabase/ssr encodes cookies as "base64-<base64url(json)>" (no padding).
    session_obj = {
        "access_token": session["access_token"],
        "refresh_token": session["refresh_token"],
        "expires_in": session.get("expires_in", 3600),
        "expires_at": session.get("expires_at"),
        "token_type": "bearer",
        "user": session.get("user"),
    }
    raw = json.dumps(session_obj, separators=(",", ":"))
    b64 = base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")
    encoded = f"base64-{b64}"

    # Chunk if > 3180 chars (MAX_CHUNK_SIZE in @supabase/ssr)
    if len(encoded) <= 3180:
        return {cookie_name: encoded}
    return {
        f"{cookie_name}.{i}": encoded[i * 3180:(i + 1) * 3180]
        for i in range((len(encoded) + 3179) // 3180)
    }


@pytest.fixture(scope="session")
def admin_client(base_url, admin_session_cookie) -> httpx.Client:
    """Authenticated httpx client with admin session cookie."""
    with httpx.Client(
        base_url=base_url,
        cookies=admin_session_cookie,
        timeout=30.0,
        follow_redirects=True,
    ) as c:
        yield c
