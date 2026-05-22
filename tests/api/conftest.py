"""
Shared fixtures for API integration tests.

Auth strategy:
- Public endpoints: no auth needed, httpx.Client used directly.
- Admin endpoints: marked @pytest.mark.admin. Require TEST_ADMIN_EMAIL +
  TEST_ADMIN_PASSWORD in env. Session is obtained by signing in via Supabase
  auth API, and the access token is set as a cookie so Next.js SSR can read it.
  Tests without these env vars are skipped automatically.
"""

import json
import os
import re

import allure
import httpx
import pytest
from dotenv import load_dotenv

# Load test env from .env.test.local (relative to project root, two levels up)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env.test.local"), override=False)

TEST_BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:3020")
TEST_SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
TEST_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
TEST_ADMIN_EMAIL = os.getenv("TEST_ADMIN_EMAIL", "")
TEST_ADMIN_PASSWORD = os.getenv("TEST_ADMIN_PASSWORD", "")


def _supabase_project_ref(supabase_url: str) -> str:
    """Extract project ref from Supabase URL, e.g. https://abc.supabase.co -> abc"""
    match = re.search(r"https://([^.]+)\.supabase\.co", supabase_url)
    return match.group(1) if match else "unknown"


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
    """
    Sign in as admin via Supabase auth API and return the session cookie dict.
    Tests decorated with @pytest.mark.admin are skipped if credentials are absent.
    """
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

    project_ref = _supabase_project_ref(TEST_SUPABASE_URL)
    # @supabase/ssr stores the session as a JSON-encoded cookie
    cookie_value = json.dumps({
        "access_token": session["access_token"],
        "refresh_token": session["refresh_token"],
        "expires_in": session.get("expires_in", 3600),
        "expires_at": session.get("expires_at"),
        "token_type": "bearer",
        "user": session.get("user"),
    })
    return {f"sb-{project_ref}-auth-token": cookie_value}


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


@pytest.fixture
def created_ids() -> list:
    """Accumulate resource IDs created by a write test for cleanup."""
    return []


@pytest.fixture(autouse=True)
def allure_base_url(base_url):
    allure.dynamic.parameter("base_url", base_url)
