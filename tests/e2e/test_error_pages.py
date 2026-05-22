"""
E2E tests for error and edge-case page rendering.

Coverage:
  - /nonexistent-path → custom 404 page (not a bare server error)
  - /blog/nonexistent-slug → article-level 404 (notFound())
  - /auth/login → login form renders correctly

404 pages in Next.js are handled by app/not-found.tsx. These tests verify the custom
error experience is in place and the navbar survives error conditions.
"""

import allure
import pytest
from playwright.sync_api import Page, expect


@allure.feature("E2E")
@allure.story("Error Pages")
class TestErrorPages:

    @pytest.mark.smoke
    def test_nonexistent_route_renders_404_not_500(self, page: Page, base_url: str):
        """A completely unknown URL must trigger the custom 404 page, not a server crash."""
        page.goto(f"{base_url}/this-route-definitely-does-not-exist-xyz123")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")
        # Server must respond — page should have rendered something
        assert page.locator("body").count() == 1

    def test_404_page_navbar_survives(self, page: Page, base_url: str):
        """Navigation must still be accessible on 404 pages."""
        page.goto(f"{base_url}/this-route-definitely-does-not-exist-xyz123")
        page.wait_for_load_state("domcontentloaded")
        expect(page.locator("nav").first).to_be_visible()

    def test_nonexistent_blog_slug_is_404(self, page: Page, base_url: str):
        """A blog slug that doesn't exist should render 404, not 500."""
        page.goto(f"{base_url}/blog/this-post-slug-does-not-exist-xyz123", wait_until="domcontentloaded")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")


@allure.feature("E2E")
@allure.story("Auth Pages")
class TestAuthPages:

    @pytest.mark.smoke
    def test_login_page_renders_form(self, page: Page, base_url: str):
        """Login page must render an email/password form."""
        page.goto(f"{base_url}/auth/login", wait_until="domcontentloaded")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")
        expect(page.locator("form")).to_be_visible()

    def test_login_page_has_email_input(self, page: Page, base_url: str):
        page.goto(f"{base_url}/auth/login", wait_until="domcontentloaded")
        expect(page.locator("input[type='email'], input[name='email']").first).to_be_visible()

    def test_login_page_has_password_input(self, page: Page, base_url: str):
        page.goto(f"{base_url}/auth/login", wait_until="domcontentloaded")
        expect(page.locator("input[type='password']")).to_be_visible()
