"""API tests for the memo_habits_server domain."""

import allure
import httpx
import pytest


@allure.feature("Memo Habits Server")
@allure.story("Status")
class TestMemoHabitsServer:

    @pytest.mark.smoke
    def test_library_only(self):
        """Memo habits server is a library module, not an HTTP endpoint."""
        pytest.skip("No HTTP endpoint exists directly for the memo_habits_server domain")
