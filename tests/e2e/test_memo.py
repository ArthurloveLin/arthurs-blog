"""
E2E for the /memo page (memo board shell + habits).

Previously zero E2E coverage. These verify the memo shell renders and its
primary controls are reachable. The habit check-in journey (create habit →
check in → streak increments → persists on reload) needs a seeded, owned habit
note and an authenticated session, so it is deferred to a live run; see TODO.
"""

import allure
import pytest
from playwright.sync_api import Page, expect


@allure.feature("E2E")
@allure.story("Memo")
class TestMemoPage:

    @pytest.mark.smoke
    def test_memo_loads(self, page: Page, base_url: str):
        page.goto(f"{base_url}/memo", wait_until="domcontentloaded")
        expect(page).not_to_have_title("404")
        expect(page).not_to_have_title("500")
        expect(page).not_to_have_title("Error")

    def test_memo_has_shell(self, page: Page, base_url: str):
        page.goto(f"{base_url}/memo")
        expect(page.locator("main, section").first).to_be_visible(timeout=20000)
        expect(page.locator("nav").first).to_be_visible()

    def test_memo_search_control_renders(self, page: Page, base_url: str):
        # MemoBoardShell exposes a search field; its presence confirms the
        # interactive shell hydrated rather than just a static skeleton.
        page.goto(f"{base_url}/memo")
        expect(page.locator("input").first).to_be_visible(timeout=20000)

    # TODO (needs live container + auth): habit journey — create a daily habit
    # note, check in an occurrence, assert the streak increments, assert a
    # double check-in is idempotent, and assert it persists on reload.
