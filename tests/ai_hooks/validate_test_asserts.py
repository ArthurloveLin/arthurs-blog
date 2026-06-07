#!/usr/bin/env python3
"""
Assert-gate for generated tests.

A test file FAILS when it contains test functions but NONE of them actually
assert anything — i.e. every test is an assertion-free skip / pass placeholder.
The existing `py_compile` + `pytest --collect-only` gates pass such files, which
is how assertion-free tests have been merged before; this closes that hole.

A test "asserts" if its body contains an `assert` statement or a
`with pytest.raises(...)` block. Files with no test functions pass (e.g. helpers).

Exit 0 if every given file has at least one asserting test; exit 1 and list the
offenders otherwise.

Usage:
    python tests/ai_hooks/validate_test_asserts.py tests/ai_generated/test_x.py ...
    find tests/ai_generated -name 'test_*.py' | xargs python tests/ai_hooks/validate_test_asserts.py
"""

import ast
import sys


def _is_pytest_raises(expr: ast.expr) -> bool:
    if isinstance(expr, ast.Call):
        func = expr.func
        name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", None)
        return name == "raises"
    return False


def _iter_test_functions(tree: ast.AST):
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith("test"):
            yield node


def _asserts_something(fn: ast.AST) -> bool:
    for node in ast.walk(fn):
        if isinstance(node, ast.Assert):
            return True
        if isinstance(node, (ast.With, ast.AsyncWith)):
            if any(_is_pytest_raises(item.context_expr) for item in node.items):
                return True
    return False


def validate_file(path: str) -> tuple[bool, str]:
    try:
        with open(path, encoding="utf-8") as f:
            tree = ast.parse(f.read())
    except (OSError, SyntaxError) as e:
        return False, f"{path}: parse error: {e}"

    tests = list(_iter_test_functions(tree))
    if not tests:
        return True, f"{path}: no test functions (skipped)"
    asserting = sum(1 for t in tests if _asserts_something(t))
    if asserting == 0:
        return False, f"{path}: {len(tests)} test(s) but NONE assert anything (assertion-free placeholder)"
    return True, f"{path}: {asserting}/{len(tests)} test(s) assert"


def main() -> None:
    files = sys.argv[1:]
    if not files:
        print("usage: validate_test_asserts.py <test_file.py> ...", file=sys.stderr)
        sys.exit(2)
    failed = False
    for path in files:
        ok, msg = validate_file(path)
        print(("OK   " if ok else "FAIL ") + msg)
        failed = failed or not ok
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
