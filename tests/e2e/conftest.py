"""
Playwright E2E test fixtures.

Browser: Chromium headless (default via pytest-playwright).
Base URL: reads TEST_BASE_URL env var, defaults to http://localhost:3020.

Install browsers once:
    playwright install chromium
"""

import os

import pytest
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env.test.local"), override=False)

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:3020")


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE_URL


# pytest-playwright auto-provides `browser`, `page`, `context` fixtures.
# We override base_url so playwright uses the test container URL.
