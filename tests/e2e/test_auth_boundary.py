"""
E2E for auth boundaries.

Behavioral, not just structural:
  - /admin/settings server-redirects non-admins to / (page.tsx: redirect('/')).
  - /auth/login renders a working email/password form (no crash).

These catch a silent auth/redirect regression that would expose the admin
settings page or break the login surface.
"""

import allure
import pytest
from playwright.sync_api import Page, expect


@allure.feature("E2E")
@allure.story("Auth Boundary")
class TestAuthBoundary:

    @pytest.mark.smoke
    def test_admin_settings_redirects_anonymous_away(self, page: Page, base_url: str):
        page.goto(f"{base_url}/admin/settings", wait_until="domcontentloaded")
        # Server redirect('/') for non-admins → we must not land on the settings page.
        expect(page).not_to_have_url(f"{base_url}/admin/settings")
        expect(page.locator("main").first).to_be_visible(timeout=20000)

    def test_login_page_renders_form(self, page: Page, base_url: str):
        page.goto(f"{base_url}/auth/login", wait_until="domcontentloaded")
        expect(page).not_to_have_title("500")
        expect(page.locator("input[name='email']")).to_be_visible(timeout=20000)
        expect(page.locator("input[name='password']")).to_be_visible()
        expect(page.locator("button[type='submit']")).to_be_visible()

    def test_invalid_login_does_not_crash(self, page: Page, base_url: str):
        # Submitting bad credentials must surface an error in-page, not a 500.
        page.goto(f"{base_url}/auth/login", wait_until="domcontentloaded")
        page.fill("input[name='email']", "nobody@example.com")
        page.fill("input[name='password']", "wrong-password")
        page.click("button[type='submit']")
        page.wait_for_load_state("domcontentloaded")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")
