#!/usr/bin/env python3
"""
Scan for source files changed in the past N hours that lack test coverage.

Outputs --output path and exits 0.
If no gaps are found, prints "NO_GAPS" to stdout and does NOT create the output
file (so the CI step can check `[ -f /tmp/coverage-gaps.md ]` as the signal).

Usage:
    python tests/ai_hooks/scan_coverage_gaps.py
    python tests/ai_hooks/scan_coverage_gaps.py --since "48 hours ago"
    python tests/ai_hooks/scan_coverage_gaps.py --repo /path/to/repo --output /tmp/out.md
"""

import argparse
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
MAX_FILES = 5
MAX_DIFF_BYTES = 3072  # 3 KB per file

# Only scan API routes. This generator emits httpx-based API tests, which can
# only exercise HTTP endpoints under app/api/.
#   - lib/ modules have no HTTP surface, so every lib gap previously produced a
#     dead `pytest.skip("No HTTP endpoint exists...")` file. They belong in a
#     unit-test harness, not here — excluded to stop that daily skip-noise.
#   - UI components (components/) and page files (app/<route>/page.tsx) require
#     Playwright E2E tests, not httpx API tests — also out of scope here.
SOURCE_DIRS = ("app/api/",)
SOURCE_EXTS = {".ts", ".tsx"}
EXCLUDE_PATTERNS = (
    ".test.", ".spec.",
    "react-canary.d.ts", "next-env.d.ts",
    "app/api/admin/",           # require service role — not safe in CI
    "app/api/deploy-notify/",   # webhook endpoint, no testable contract
)

TEST_DIRS = ("tests/api/", "tests/e2e/")


# ── Git helpers ───────────────────────────────────────────────────────────────

def _git(*args, cwd: Path) -> str:
    result = subprocess.run(
        ["git", *args], capture_output=True, text=True, cwd=cwd
    )
    if result.returncode != 0:
        raise subprocess.CalledProcessError(result.returncode, ["git", *args], result.stdout, result.stderr)
    return result.stdout


def get_changed_source_files(repo_root: Path, since: str) -> list[str]:
    """Return deduplicated source file paths changed (Added/Modified) since `since`."""
    try:
        raw = _git(
            "log", f"--since={since}", "--name-only", "--format=",
            "--diff-filter=AM",
            cwd=repo_root,
        )
    except subprocess.CalledProcessError as e:
        print(f"WARNING: git log failed: {e.stderr}", file=sys.stderr)
        return []

    seen: set[str] = set()
    result: list[str] = []
    for line in raw.splitlines():
        path = line.strip()
        if path and path not in seen:
            seen.add(path)
            result.append(path)
    return result


def get_diff_for_file(repo_root: Path, path: str, max_bytes: int) -> str:
    """Get unified diff for a file; fall back to file content on failure."""
    try:
        raw = _git("diff", "HEAD~1", "HEAD", "--", path, cwd=repo_root)
        if not raw:
            raise ValueError("empty diff")
    except (subprocess.CalledProcessError, ValueError):
        # New file or shallow clone — show the file content directly
        try:
            raw = (repo_root / path).read_text(encoding="utf-8", errors="replace")
        except OSError:
            raw = "(unable to read file)"

    encoded = raw.encode("utf-8")
    if len(encoded) > max_bytes:
        raw = encoded[:max_bytes].decode("utf-8", errors="replace") + "\n...(truncated)"
    return raw


# ── Source file filtering ─────────────────────────────────────────────────────

def is_source_file(path: str) -> bool:
    p = Path(path)
    if p.suffix not in SOURCE_EXTS:
        return False
    if not any(path.startswith(d) for d in SOURCE_DIRS):
        return False
    if any(pat in path for pat in EXCLUDE_PATTERNS):
        return False
    return True


def extract_domain_word(path: str) -> str | None:
    """
    Derive the domain word used to look up test coverage.

    Examples:
      app/api/blog/search/route.ts      → "blog"
      app/api/note-boards/memo/route.ts → "note_boards"
      lib/spotify.ts                    → "spotify"
      components/Navbar.tsx             → "navbar"
      components/note-board/Shell.tsx   → "note_board"
    """
    parts = Path(path).parts

    if len(parts) >= 3 and parts[0] == "app" and parts[1] == "api":
        word = parts[2]
    elif parts[0] == "lib":
        word = Path(path).stem
    elif parts[0] == "components" and len(parts) > 1:
        # Use the stem (no extension) of the second segment, whether it's a
        # directory name or a top-level component file like Navbar.tsx
        word = Path(parts[1]).stem
    else:
        word = Path(path).stem

    return word.replace("-", "_").lower() or None


# ── Coverage index ────────────────────────────────────────────────────────────

def build_coverage_index(repo_root: Path) -> set[str]:
    """Return domain words covered by existing test files."""
    covered: set[str] = set()
    for test_dir in TEST_DIRS:
        test_path = repo_root / test_dir
        if not test_path.exists():
            continue
        for f in test_path.glob("test_*.py"):
            stem = f.stem[len("test_"):]  # strip "test_" prefix
            covered.add(stem)
    return covered


# ── Report builder ────────────────────────────────────────────────────────────

def build_report(gaps: list[dict]) -> str:
    now = datetime.now(timezone.utc).isoformat()
    lines = [
        "# Coverage Gaps Report",
        "",
        f"**Generated:** {now}",
        f"**Gaps found:** {len(gaps)} source file(s) changed in the last 24h with no corresponding test",
        "",
        "---",
        "",
    ]
    for g in gaps:
        lines += [
            f"## `{g['path']}`",
            "",
            f"**Domain word:** `{g['domain']}`",
            f"**No test file matching:** `tests/api/test_{g['domain']}.py` "
            f"or `tests/e2e/test_{g['domain']}.py`",
            "",
            "### Recent diff / content",
            "",
            "```typescript",
            g["diff"],
            "```",
            "",
        ]
    return "\n".join(lines)


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--since", default="24 hours ago")
    parser.add_argument("--repo", default=".", help="Path to git repo root")
    parser.add_argument("--output", default="/tmp/coverage-gaps.md")
    args = parser.parse_args()

    repo_root = Path(args.repo).resolve()

    changed = get_changed_source_files(repo_root, args.since)
    source_files = [f for f in changed if is_source_file(f)]
    covered = build_coverage_index(repo_root)

    gaps: list[dict] = []
    for path in source_files:
        if len(gaps) >= MAX_FILES:
            break
        domain = extract_domain_word(path)
        # Allow singular/plural variants: "note_board" matches "note_boards"
        if domain and not any(
            c == domain or c.startswith(domain) or domain.startswith(c)
            for c in covered
        ):
            diff = get_diff_for_file(repo_root, path, MAX_DIFF_BYTES)
            gaps.append({"path": path, "domain": domain, "diff": diff})

    if not gaps:
        print("NO_GAPS: no changed source files without test coverage")
        sys.exit(0)

    report = build_report(gaps)
    Path(args.output).write_text(report, encoding="utf-8")
    print(f"GAP_FOUND: {len(gaps)} gap(s) written to {args.output}")
    sys.exit(0)


if __name__ == "__main__":
    main()
