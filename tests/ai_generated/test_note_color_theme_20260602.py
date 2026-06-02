# tested-source: lib/note-color-theme.ts
"""API tests for the note_color_theme domain."""

import allure
import pytest


@allure.feature("Note Color Theme")
@allure.story("Status")
class TestNoteColorTheme:

    @pytest.mark.smoke
    def test_library_only(self):
        """Note color theme is a library module, not an HTTP endpoint."""
        pytest.skip("No HTTP endpoint exists directly for the note_color_theme domain")
