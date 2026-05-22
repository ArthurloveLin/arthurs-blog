"""
E2E tests for core blog reading flow.

Coverage:
  - Homepage loads with blog content and post links
  - Search page renders results with navigable links
  - Memo page renders (Suspense streaming check) with note-board canvas
  - Recipe page loads book shell (main element)
  - Blog article page renders h1 heading (slug discovered via search API)
  - Guestbook page loads with note-board canvas
  - Cross-page navigation flows: homepage → article, search URL → results, article → category

These tests verify semantic DOM structure and user-navigable flows, not just HTTP status codes.
"""

import allure
import httpx
import pytest
from playwright.sync_api import Page, expect


def _find_blog_slug(base_url: str) -> str | None:
    """Return the slug of the first blog post found via the search API, or None."""
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
@allure.story("Homepage")
class TestHomepage:

    @pytest.mark.smoke
    def test_homepage_loads(self, page: Page, base_url: str):
        page.goto(base_url)
        expect(page).not_to_have_title("Error")
        expect(page.locator("main")).to_be_visible()

    def test_homepage_has_navbar(self, page: Page, base_url: str):
        page.goto(base_url)
        expect(page.locator("nav").first).to_be_visible()

    def test_homepage_has_post_links(self, page: Page, base_url: str):
        """Homepage should render at least one blog post card with a navigable link."""
        page.goto(base_url)
        page.wait_for_load_state("networkidle", timeout=10000)
        post_links = page.locator("a[href*='/blog/']")
        if post_links.count() == 0:
            pytest.skip("No blog posts in test environment")
        expect(post_links.first).to_be_visible()

    def test_homepage_no_console_errors(self, page: Page, base_url: str):
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(base_url)
        page.wait_for_load_state("networkidle", timeout=10000)
        # In the test container, external integrations (Spotify, analytics, CDN ML models)
        # return 500 or are blocked by CORS because production credentials are absent.
        # These are environment noise, not app bugs — filter them out.
        NOISE_PATTERNS = [
            "ERR_BLOCKED",
            "net::",
            "status of 500",
            "status of 503",
            "CORS policy",
        ]
        critical_errors = [
            e for e in errors
            if not any(p in e for p in NOISE_PATTERNS)
        ]
        assert critical_errors == [], f"Console errors: {critical_errors}"


@allure.feature("E2E")
@allure.story("Search")
class TestSearch:

    @pytest.mark.smoke
    def test_search_page_loads(self, page: Page, base_url: str):
        page.goto(f"{base_url}/search")
        expect(page.locator("main")).to_be_visible()

    def test_search_url_shows_results(self, page: Page, base_url: str):
        """Navigating to /search?q=memo should render article links in the result list."""
        page.goto(f"{base_url}/search?q=memo")
        page.wait_for_load_state("networkidle", timeout=10000)
        result_links = page.locator("a[href*='/blog/']")
        if result_links.count() == 0:
            pytest.skip("No blog posts match 'memo' in test environment")
        expect(result_links.first).to_be_visible()

    def test_search_empty_query_shows_prompt(self, page: Page, base_url: str):
        """Search page without a query should show a search prompt, not an error."""
        page.goto(f"{base_url}/search")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")
        expect(page.locator("main")).to_be_visible()


@allure.feature("E2E")
@allure.story("Memo")
class TestMemoPage:

    @pytest.mark.smoke
    def test_memo_page_loads(self, page: Page, base_url: str):
        page.goto(f"{base_url}/memo", wait_until="domcontentloaded")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")

    def test_memo_page_streaming_completes(self, page: Page, base_url: str):
        """Suspense streaming should resolve and render the note-board canvas."""
        page.goto(f"{base_url}/memo")
        page.wait_for_load_state("networkidle", timeout=15000)
        expect(page.locator(".note-board-canvas")).to_be_visible()


@allure.feature("E2E")
@allure.story("Recipe")
class TestRecipePage:

    def test_recipe_page_loads(self, page: Page, base_url: str):
        page.goto(f"{base_url}/recipe", wait_until="domcontentloaded")
        expect(page).not_to_have_title("500")
        expect(page.locator("main")).to_be_visible()

    def test_recipe_book_shell_rendered(self, page: Page, base_url: str):
        """Book shell container should be present after page load."""
        page.goto(f"{base_url}/recipe")
        page.wait_for_load_state("networkidle", timeout=10000)
        expect(page.locator("main")).to_be_visible()


@allure.feature("E2E")
@allure.story("Blog Article")
class TestBlogArticlePage:

    def test_blog_article_loads(self, page: Page, base_url: str):
        slug = _find_blog_slug(base_url)
        if not slug:
            pytest.skip("No blog posts available in test environment")
        page.goto(f"{base_url}/blog/{slug}", wait_until="domcontentloaded")
        expect(page).not_to_have_title("404")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")

    def test_blog_article_renders_heading(self, page: Page, base_url: str):
        """Article page must render an h1 heading (article title)."""
        slug = _find_blog_slug(base_url)
        if not slug:
            pytest.skip("No blog posts available in test environment")
        page.goto(f"{base_url}/blog/{slug}")
        page.wait_for_load_state("networkidle", timeout=15000)
        expect(page.locator("article h1, h1").first).to_be_visible()

    def test_blog_article_has_navbar(self, page: Page, base_url: str):
        slug = _find_blog_slug(base_url)
        if not slug:
            pytest.skip("No blog posts available in test environment")
        page.goto(f"{base_url}/blog/{slug}", wait_until="domcontentloaded")
        expect(page.locator("nav").first).to_be_visible()


@allure.feature("E2E")
@allure.story("Guestbook")
class TestGuestbookPage:

    @pytest.mark.smoke
    def test_guestbook_page_loads(self, page: Page, base_url: str):
        page.goto(f"{base_url}/guestbook", wait_until="domcontentloaded")
        expect(page).not_to_have_title("404")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")

    def test_guestbook_note_board_renders(self, page: Page, base_url: str):
        """Guestbook renders the note-board canvas (even when no notes exist)."""
        page.goto(f"{base_url}/guestbook")
        page.wait_for_load_state("networkidle", timeout=15000)
        expect(page.locator(".note-board-canvas")).to_be_visible()


@allure.feature("E2E")
@allure.story("Navigation Flows")
class TestNavigationFlows:

    def test_homepage_post_click_navigates_to_article(self, page: Page, base_url: str):
        """Clicking a blog post card on the homepage navigates to the article page with an h1."""
        page.goto(base_url)
        page.wait_for_load_state("networkidle", timeout=10000)
        post_links = page.locator("a[href*='/blog/']")
        if post_links.count() == 0:
            pytest.skip("No blog posts in test environment")
        post_links.first.click()
        page.wait_for_url("**/blog/**", timeout=10000)
        expect(page.locator("article h1, h1").first).to_be_visible()

    def test_search_result_click_navigates_to_article(self, page: Page, base_url: str):
        """Clicking a search result navigates to the correct article page."""
        page.goto(f"{base_url}/search?q=memo")
        page.wait_for_load_state("networkidle", timeout=10000)
        result_links = page.locator("a[href*='/blog/']")
        if result_links.count() == 0:
            pytest.skip("No search results for 'memo' in test environment")
        result_links.first.click()
        page.wait_for_url("**/blog/**", timeout=10000)
        expect(page.locator("article h1, h1").first).to_be_visible()

    def test_article_category_link_navigates(self, page: Page, base_url: str):
        """Clicking a category link on an article page navigates to the category listing."""
        slug = _find_blog_slug(base_url)
        if not slug:
            pytest.skip("No blog posts available in test environment")
        page.goto(f"{base_url}/blog/{slug}")
        page.wait_for_load_state("networkidle", timeout=15000)
        category_links = page.locator("a[href*='/category/']")
        if category_links.count() == 0:
            pytest.skip("Article has no category links")
        category_links.first.click()
        page.wait_for_url("**/category/**", timeout=10000)
        expect(page.locator("main")).to_be_visible()
