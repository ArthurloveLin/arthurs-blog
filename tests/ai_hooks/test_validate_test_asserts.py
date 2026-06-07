"""Unit tests for the assert-gate (validate_test_asserts.py)."""

import importlib.util
import pathlib

_HOOKS = pathlib.Path(__file__).parent


def _load(name):
    spec = importlib.util.spec_from_file_location(name, _HOOKS / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


gate = _load("validate_test_asserts")


def _write(tmp_path, body):
    p = tmp_path / "test_sample.py"
    p.write_text(body, encoding="utf-8")
    return str(p)


def test_assertion_free_test_fails(tmp_path):
    path = _write(tmp_path, "import pytest\n\ndef test_x():\n    pytest.skip('todo')\n")
    ok, msg = gate.validate_file(path)
    assert not ok
    assert "NONE assert" in msg


def test_asserting_test_passes(tmp_path):
    ok, _ = gate.validate_file(_write(tmp_path, "def test_x():\n    assert 1 == 1\n"))
    assert ok


def test_pytest_raises_counts_as_assert(tmp_path):
    body = "import pytest\n\ndef test_x():\n    with pytest.raises(ValueError):\n        raise ValueError()\n"
    ok, _ = gate.validate_file(_write(tmp_path, body))
    assert ok


def test_file_without_tests_passes(tmp_path):
    ok, _ = gate.validate_file(_write(tmp_path, "def helper():\n    return 1\n"))
    assert ok


def test_mixed_one_asserting_passes(tmp_path):
    body = "import pytest\n\ndef test_a():\n    pytest.skip('x')\n\ndef test_b():\n    assert True\n"
    ok, _ = gate.validate_file(_write(tmp_path, body))
    assert ok
