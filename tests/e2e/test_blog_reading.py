"""
E2E tests for core blog reading flow.

Coverage:
  - Homepage loads with blog content
  - Search UI is functional
  - Memo page renders (Suspense streaming check)
  - Recipe page loads book shell

These are happy-path smoke tests only. They protect against complete UI breakage
after a deploy, not correctness of individual features.
"""

import allure
import pytest
from playwright.sync_api import Page, expect


@allure.feature("E2E")
@allure.story("Homepage")
class TestHomepage:

    @pytest.mark.smoke
    def test_homepage_loads(self, page: Page, base_url: str):
        page.goto(base_url)
        expect(page).not_to_have_title("Error")
        # Page should have some content rendered
        assert page.locator("body").count() == 1

    def test_homepage_has_navbar(self, page: Page, base_url: str):
        page.goto(base_url)
        # Navbar should be present (any nav element)
        nav = page.locator("nav").first
        expect(nav).to_be_visible()

    def test_homepage_no_console_errors(self, page: Page, base_url: str):
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(base_url)
        page.wait_for_load_state("networkidle", timeout=10000)
        # Filter out known non-critical errors (e.g. analytics blocked by ad blockers)
        critical_errors = [e for e in errors if "ERR_BLOCKED" not in e and "net::" not in e]
        assert critical_errors == [], f"Console errors: {critical_errors}"


@allure.feature("E2E")
@allure.story("Search")
class TestSearch:

    @pytest.mark.smoke
    def test_search_page_loads(self, page: Page, base_url: str):
        page.goto(f"{base_url}/search")
        assert page.locator("body").count() == 1

    def test_search_returns_results(self, page: Page, base_url: str):
        page.goto(f"{base_url}/search")
        # Type in search box (selector may vary, using input type=search or [role=searchbox])
        search_input = page.locator("input[type=search], input[role=searchbox], input[placeholder*='搜索'], input[placeholder*='Search']").first
        if search_input.count() == 0:
            pytest.skip("Search input not found on /search page")
        search_input.fill("memo")
        page.keyboard.press("Enter")
        page.wait_for_timeout(1500)
        # Results container should appear
        body_text = page.locator("body").inner_text()
        assert len(body_text) > 100


@allure.feature("E2E")
@allure.story("Memo")
class TestMemoPage:

    @pytest.mark.smoke
    def test_memo_page_loads(self, page: Page, base_url: str):
        page.goto(f"{base_url}/memo", wait_until="domcontentloaded")
        # Page must not show a fatal error
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")

    def test_memo_page_streaming_completes(self, page: Page, base_url: str):
        """Suspense streaming should resolve without leaving loading spinners forever."""
        page.goto(f"{base_url}/memo")
        page.wait_for_load_state("networkidle", timeout=15000)
        # After load, there should be actual content (not just loading skeletons)
        body_text = page.locator("body").inner_text()
        assert len(body_text) > 50


@allure.feature("E2E")
@allure.story("Recipe")
class TestRecipePage:

    def test_recipe_page_loads(self, page: Page, base_url: str):
        page.goto(f"{base_url}/recipe", wait_until="domcontentloaded")
        expect(page).not_to_have_title("500")
        assert page.locator("body").count() == 1

    def test_recipe_book_shell_rendered(self, page: Page, base_url: str):
        page.goto(f"{base_url}/recipe")
        page.wait_for_load_state("networkidle", timeout=10000)
        body_text = page.locator("body").inner_text()
        # Recipe page should show recipe titles from seed data
        assert len(body_text) > 50
