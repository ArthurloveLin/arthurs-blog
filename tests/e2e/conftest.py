"""
Playwright E2E test fixtures.

Browser: Chromium headless (default via pytest-playwright).
Base URL: reads TEST_BASE_URL env var, defaults to http://localhost:3020.

Install browsers once:
    playwright install chromium

Fixtures:
  base_url      — resolved test server URL (session-scoped)
  mobile_page   — Chromium page at 375×812 (iPhone SE viewport), function-scoped
"""

import os

import pytest
from dotenv import load_dotenv
from playwright.sync_api import Browser, Page

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env.test.local"), override=False)

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:3020")


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE_URL


# pytest-playwright auto-provides `browser`, `page`, `context` fixtures.
# We override base_url so playwright uses the test container URL.


@pytest.fixture
def mobile_page(browser: Browser) -> Page:
    """Chromium page at 375×812 viewport — matches iPhone SE / most small Android phones."""
    context = browser.new_context(
        viewport={"width": 375, "height": 812},
        user_agent=(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        ),
    )
    page = context.new_page()
    yield page
    context.close()
