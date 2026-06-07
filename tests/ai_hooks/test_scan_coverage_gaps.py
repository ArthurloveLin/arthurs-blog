"""Unit tests for the coverage-gap scanner (scan_coverage_gaps.py).

These run without the test container — pure path/AST logic — so they execute in
the nightly js-tests-adjacent lane and locally via `pytest tests/ai_hooks`.
"""

import importlib.util
import pathlib

_HOOKS = pathlib.Path(__file__).parent


def _load(name):
    spec = importlib.util.spec_from_file_location(name, _HOOKS / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


scan = _load("scan_coverage_gaps")


def _make_repo(tmp_path, files):
    for rel, content in files.items():
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    return tmp_path


def test_normalize_source_strips_route_suffix():
    assert scan.normalize_source("app/api/health/route.ts") == "app/api/health"
    assert scan.normalize_source("./app/api/health/route.tsx") == "app/api/health"
    assert scan.normalize_source("app/api/health") == "app/api/health"


def test_extract_domain_word():
    assert scan.extract_domain_word("app/api/note-boards/memo/route.ts") == "note_boards"
    assert scan.extract_domain_word("app/api/blog/search/route.ts") == "blog"


def test_is_source_file_excludes_admin_and_non_api():
    assert scan.is_source_file("app/api/health/route.ts")
    assert not scan.is_source_file("app/api/admin/config/route.ts")
    assert not scan.is_source_file("lib/foo.ts")
    assert not scan.is_source_file("app/api/health/route.test.ts")


def test_header_and_domain_coverage(tmp_path):
    _make_repo(tmp_path, {
        "tests/api/test_foo.py": "# tested-source: app/api/foo/route.ts\n",
        "tests/api/test_bar.py": "x = 1\n",  # domain 'bar', no header
        "tests/ai_generated/test_health_20260101.py": "# tested-source: app/api/health/route.ts\n",
    })
    sources, domains = scan.build_coverage_index(tmp_path)
    assert "app/api/foo" in sources
    assert "app/api/health" in sources  # ai_generated/ now counts as coverage
    assert "bar" in domains
    assert scan.is_covered("app/api/foo/route.ts", sources, domains)     # exact header
    assert scan.is_covered("app/api/bar/route.ts", sources, domains)     # domain fallback
    assert scan.is_covered("app/api/health/route.ts", sources, domains)  # ai_generated header
    assert not scan.is_covered("app/api/baz/route.ts", sources, domains)


def test_date_suffix_stripped_for_domain(tmp_path):
    _make_repo(tmp_path, {"tests/ai_generated/test_memo_20260523.py": "x = 1\n"})
    _, domains = scan.build_coverage_index(tmp_path)
    assert "memo" in domains  # trailing _YYYYMMDD stripped


def test_all_routes_enumeration_and_filtering(tmp_path):
    _make_repo(tmp_path, {
        "app/api/a/route.ts": "export {}\n",
        "app/api/b/c/route.ts": "export {}\n",
        "app/api/admin/x/route.ts": "export {}\n",
    })
    routes = scan.get_all_route_files(tmp_path)
    assert "app/api/a/route.ts" in routes
    assert "app/api/b/c/route.ts" in routes
    # admin is enumerated but filtered out by is_source_file
    assert "app/api/admin/x/route.ts" not in [r for r in routes if scan.is_source_file(r)]
