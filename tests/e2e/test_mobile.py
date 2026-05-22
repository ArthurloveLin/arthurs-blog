"""
E2E tests for mobile viewport (375×812, iPhone SE equivalent).

This project uses React View Transitions and a responsive nav. These tests verify
the mobile experience isn't broken by desktop-focused changes.

Coverage:
  - Navbar is accessible (not hidden/clipped) on mobile
  - Homepage renders post content on mobile
  - Blog article page renders h1 on mobile
  - Search page is accessible on mobile
"""

import allure
import httpx
import pytest
from playwright.sync_api import Page, expect


def _find_blog_slug(base_url: str) -> str | None:
    for query in ["blog", "memo", "spotify", "the", "我"]:
        try:
            resp = httpx.get(
                f"{base_url}/api/blog/search",
                params={"q": query, "limit": "1"},
                timeout=10,
            )
            results = resp.json().get("results", [])
            if results:
                return results[0]["slug"]
        except Exception:
            continue
    return None


@allure.feature("E2E")
@allure.story("Mobile")
class TestMobileViewport:

    @pytest.mark.smoke
    def test_homepage_loads_on_mobile(self, mobile_page: Page, base_url: str):
        mobile_page.goto(base_url)
        expect(mobile_page).not_to_have_title("Error")
        expect(mobile_page.locator("main")).to_be_visible()

    def test_navbar_accessible_on_mobile(self, mobile_page: Page, base_url: str):
        """Navigation must be reachable on mobile (bottom dock must be visible)."""
        mobile_page.goto(base_url, wait_until="domcontentloaded")
        # The desktop nav has class "hidden md:flex" — CSS-hidden on 375px viewport.
        # On mobile, navigation uses a fixed bottom dock (md:hidden = visible on mobile).
        mobile_dock = mobile_page.locator("div[class*='bottom-5']").first
        expect(mobile_dock).to_be_visible()

    def test_homepage_no_horizontal_overflow(self, mobile_page: Page, base_url: str):
        """Page must not exceed viewport width (horizontal scroll on mobile is a layout bug)."""
        mobile_page.goto(base_url)
        mobile_page.wait_for_load_state("networkidle", timeout=10000)
        scroll_width = mobile_page.evaluate("document.documentElement.scrollWidth")
        viewport_width = mobile_page.evaluate("window.innerWidth")
        assert scroll_width <= viewport_width, (
            f"Horizontal overflow detected: scrollWidth={scroll_width} > innerWidth={viewport_width}"
        )

    def test_blog_article_renders_on_mobile(self, mobile_page: Page, base_url: str):
        slug = _find_blog_slug(base_url)
        if not slug:
            pytest.skip("No blog posts available in test environment")
        mobile_page.goto(f"{base_url}/blog/{slug}")
        mobile_page.wait_for_load_state("networkidle", timeout=15000)
        expect(mobile_page.locator("article h1, h1").first).to_be_visible()

    def test_search_page_accessible_on_mobile(self, mobile_page: Page, base_url: str):
        mobile_page.goto(f"{base_url}/search", wait_until="domcontentloaded")
        expect(mobile_page).not_to_have_title("500")
        expect(mobile_page.locator("main")).to_be_visible()

    def test_memo_page_accessible_on_mobile(self, mobile_page: Page, base_url: str):
        mobile_page.goto(f"{base_url}/memo", wait_until="domcontentloaded")
        expect(mobile_page).not_to_have_title("500")
        expect(mobile_page).not_to_have_title("Error")
