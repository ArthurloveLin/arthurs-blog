# tested-source: lib/memo-due-tags.ts
"""API tests for the memo_due_tags domain."""

import allure
import pytest


@allure.feature("Memo Due Tags")
@allure.story("Status")
class TestMemoDueTags:

    @pytest.mark.smoke
    def test_library_only(self):
        """Memo due tags is a library module, not an HTTP endpoint."""
        pytest.skip("No HTTP endpoint exists directly for the memo_due_tags domain")
