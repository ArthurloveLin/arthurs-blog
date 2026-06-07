"""
E2E for the guestbook (note board) page.

The /guestbook route previously had zero E2E coverage. These verify the page
and its compose entry point render — i.e. the posting journey is reachable —
without actually submitting (a real post writes a row with no e2e cleanup
fixture, and the compose flow's exact selectors must be confirmed against a
running container). The full compose→submit→assert-card journey is deferred to
a live run; see TODO below.
"""

import allure
import pytest
from playwright.sync_api import Page, expect


@allure.feature("E2E")
@allure.story("Guestbook")
class TestGuestbookPage:

    @pytest.mark.smoke
    def test_guestbook_loads(self, page: Page, base_url: str):
        page.goto(f"{base_url}/guestbook", wait_until="domcontentloaded")
        expect(page).not_to_have_title("404")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")

    def test_guestbook_has_shell(self, page: Page, base_url: str):
        page.goto(f"{base_url}/guestbook")
        expect(page.locator("main").first).to_be_visible(timeout=20000)
        expect(page.locator("nav").first).to_be_visible()

    def test_guestbook_compose_entry_point_renders(self, page: Page, base_url: str):
        # The note board exposes a compose surface (textarea or contenteditable
        # editor). Asserting it is present verifies the posting journey is reachable.
        page.goto(f"{base_url}/guestbook")
        editor = page.locator("textarea, [contenteditable='true']").first
        expect(editor).to_be_visible(timeout=20000)

    # TODO (needs live container): full journey — type into the editor, pick a
    # color/priority, submit, assert a new sticky card appears, assert empty
    # submit is rejected, assert the card persists on reload, and assert a 429
    # surfaces when the comment rate limiter trips. Requires confirmed selectors
    # and a cleanup step for the created row.
