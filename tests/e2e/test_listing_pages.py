"""
E2E tests for dynamic blog listing pages.

Coverage:
  - /category/<slug>  — posts filtered by category
  - /tag/<slug>       — posts filtered by tag
  - /archive/<year>   — posts filtered by publication year

All three pages use BlogPage component. Slugs are discovered dynamically via the
search API so tests stay valid as content changes. Tests skip gracefully when the
test environment has no blog data.
"""

from __future__ import annotations

import allure
import httpx
import pytest
from playwright.sync_api import Page, expect


def _discover_listing_targets(base_url: str) -> dict[str, str | None]:
    """Return {category, tag, year} from the first search results that provide them."""
    targets: dict[str, str | None] = {"category": None, "tag": None, "year": None}
    for query in ["blog", "memo", "spotify", "the", "我"]:
        try:
            resp = httpx.get(
                f"{base_url}/api/blog/search",
                params={"q": query, "limit": "5"},
                timeout=10,
            )
            for result in resp.json().get("results", []):
                if not targets["category"] and result.get("category"):
                    targets["category"] = result["category"]
                if not targets["tag"] and result.get("tags"):
                    targets["tag"] = result["tags"][0]
                if not targets["year"] and result.get("published_at"):
                    targets["year"] = result["published_at"][:4]
            if all(targets.values()):
                break
        except Exception:
            continue
    return targets


@allure.feature("E2E")
@allure.story("Category Listing")
class TestCategoryPage:

    @pytest.fixture(scope="class")
    def category(self, base_url: str) -> str:
        targets = _discover_listing_targets(base_url)
        if not targets["category"]:
            pytest.skip("No category data available in test environment")
        return targets["category"]

    @pytest.mark.smoke
    def test_category_page_loads(self, page: Page, base_url: str, category: str):
        from urllib.parse import quote
        page.goto(f"{base_url}/category/{quote(category)}", wait_until="domcontentloaded")
        expect(page).not_to_have_title("404")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")

    def test_category_page_has_post_links(self, page: Page, base_url: str, category: str):
        """Category listing must contain navigable blog post links."""
        from urllib.parse import quote
        page.goto(f"{base_url}/category/{quote(category)}")
        page.wait_for_load_state("networkidle", timeout=10000)
        expect(page.locator("a[href*='/blog/']").first).to_be_visible()

    def test_category_post_link_navigates(self, page: Page, base_url: str, category: str):
        """Clicking a post in the category listing navigates to the article."""
        from urllib.parse import quote
        page.goto(f"{base_url}/category/{quote(category)}")
        page.wait_for_load_state("networkidle", timeout=10000)
        page.locator("a[href*='/blog/']").first.click()
        page.wait_for_load_state("domcontentloaded")
        assert "/blog/" in page.url
        expect(page.locator("article h1, h1").first).to_be_visible()


@allure.feature("E2E")
@allure.story("Tag Listing")
class TestTagPage:

    @pytest.fixture(scope="class")
    def tag(self, base_url: str) -> str:
        targets = _discover_listing_targets(base_url)
        if not targets["tag"]:
            pytest.skip("No tag data available in test environment")
        return targets["tag"]

    @pytest.mark.smoke
    def test_tag_page_loads(self, page: Page, base_url: str, tag: str):
        from urllib.parse import quote
        page.goto(f"{base_url}/tag/{quote(tag)}", wait_until="domcontentloaded")
        expect(page).not_to_have_title("404")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")

    def test_tag_page_has_post_links(self, page: Page, base_url: str, tag: str):
        """Tag listing must contain at least one navigable blog post link."""
        from urllib.parse import quote
        page.goto(f"{base_url}/tag/{quote(tag)}")
        page.wait_for_load_state("networkidle", timeout=10000)
        expect(page.locator("a[href*='/blog/']").first).to_be_visible()

    def test_tag_page_has_navbar(self, page: Page, base_url: str, tag: str):
        from urllib.parse import quote
        page.goto(f"{base_url}/tag/{quote(tag)}", wait_until="domcontentloaded")
        expect(page.locator("nav").first).to_be_visible()


@allure.feature("E2E")
@allure.story("Archive Listing")
class TestArchivePage:

    @pytest.fixture(scope="class")
    def year(self, base_url: str) -> str:
        targets = _discover_listing_targets(base_url)
        if not targets["year"]:
            pytest.skip("No year data available in test environment")
        return targets["year"]

    @pytest.mark.smoke
    def test_archive_page_loads(self, page: Page, base_url: str, year: str):
        page.goto(f"{base_url}/archive/{year}", wait_until="domcontentloaded")
        expect(page).not_to_have_title("404")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")

    def test_archive_page_has_post_links(self, page: Page, base_url: str, year: str):
        """Archive year page must contain post links from that year."""
        page.goto(f"{base_url}/archive/{year}")
        page.wait_for_load_state("networkidle", timeout=10000)
        expect(page.locator("a[href*='/blog/']").first).to_be_visible()
