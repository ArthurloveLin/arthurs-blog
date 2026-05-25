"""API tests for the ntfy domain."""

import allure
import pytest


@allure.feature("Ntfy")
@allure.story("Status")
class TestNtfy:

    @pytest.mark.smoke
    def test_library_only(self):
        """Ntfy is a library module, not an HTTP endpoint."""
        pytest.skip("No HTTP endpoint exists directly for the ntfy domain")
