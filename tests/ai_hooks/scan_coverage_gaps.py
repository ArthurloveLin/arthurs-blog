#!/usr/bin/env python3
"""
Scan API routes that lack test coverage and emit a gap report for the generator.

Two modes:
  (default, delta)  routes changed in the last N hours with no test → fast daily lane
  --all-routes      EVERY app/api route with no test → weekly full-surface backfill
                    (catches routes that were never touched since the suite began)

Coverage is computed from the `# tested-source: <path>` header that generated
tests carry (exact, and includes tests/ai_generated/ so already-covered domains
like memo/health/changelog are not regenerated), with a domain-word fallback
(test filename) for legacy hand-written tests that predate the header.

Outputs --output path and exits 0. When no gaps are found, prints "NO_GAPS" and
does NOT create the output file (the CI step checks `[ -f <output> ]`).

Usage:
    python tests/ai_hooks/scan_coverage_gaps.py
    python tests/ai_hooks/scan_coverage_gaps.py --since "48 hours ago"
    python tests/ai_hooks/scan_coverage_gaps.py --all-routes
    python tests/ai_hooks/scan_coverage_gaps.py --repo /path/to/repo --output /tmp/out.md
"""

import argparse
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
MAX_FILES = 5
MAX_DIFF_BYTES = 3072  # 3 KB per file

# Only scan API routes. This generator emits httpx-based API tests, which can
# only exercise HTTP endpoints under app/api/.
#   - lib/ modules have no HTTP surface (they belong in the vitest unit harness).
#   - UI components / page files require Playwright E2E tests, not httpx.
SOURCE_DIRS = ("app/api/",)
SOURCE_EXTS = {".ts", ".tsx"}
EXCLUDE_PATTERNS = (
    ".test.", ".spec.",
    "react-canary.d.ts", "next-env.d.ts",
    "app/api/admin/",           # require service role — not safe in CI
    "app/api/deploy-notify/",   # webhook endpoint, no testable contract
)

# Coverage is read from ALL test dirs incl. ai_generated, so the generator's own
# output counts and routes are not regenerated every time they change.
TEST_DIRS = ("tests/api/", "tests/e2e/", "tests/ai_generated/")

_DATE_SUFFIX = re.compile(r"_\d{8}$")
_HEADER = re.compile(r"#\s*tested-source:\s*(.+)")


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


def get_all_route_files(repo_root: Path) -> list[str]:
    """Return every app/api/**/route.ts(x) path, sorted (full-surface mode)."""
    api_dir = repo_root / "app" / "api"
    if not api_dir.exists():
        return []
    out: list[str] = []
    for ext in sorted(SOURCE_EXTS):
        out += [str(p.relative_to(repo_root)) for p in api_dir.rglob(f"route{ext}")]
    return sorted(out)


def get_diff_for_file(repo_root: Path, path: str, max_bytes: int) -> str:
    """Get unified diff for a file; fall back to file content on failure."""
    try:
        raw = _git("diff", "HEAD~1", "HEAD", "--", path, cwd=repo_root)
        if not raw:
            raise ValueError("empty diff")
    except (subprocess.CalledProcessError, ValueError):
        # New file, shallow clone, or full-surface mode — show file content.
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


def normalize_source(path: str) -> str:
    """Normalize a source path for exact comparison: drop a trailing /route.ts(x)."""
    p = path.strip().lstrip("./")
    return re.sub(r"/route\.tsx?$", "", p)


def extract_domain_word(path: str) -> str | None:
    """Derive the domain word for a source path (fallback coverage key).

    app/api/blog/search/route.ts      → "blog"
    app/api/note-boards/memo/route.ts → "note_boards"
    """
    parts = Path(path).parts
    if len(parts) >= 3 and parts[0] == "app" and parts[1] == "api":
        word = parts[2]
    else:
        word = Path(path).stem
    return word.replace("-", "_").lower() or None


# ── Coverage index ────────────────────────────────────────────────────────────

def read_tested_sources(file_path: Path) -> list[str]:
    """Return all '# tested-source: <path>' values from a test file's header region."""
    sources: list[str] = []
    try:
        with open(file_path, encoding="utf-8") as f:
            for i, line in enumerate(f):
                if i >= 12:
                    break
                m = _HEADER.match(line.strip())
                if m:
                    sources.append(m.group(1).strip())
    except OSError:
        pass
    return sources


def build_coverage_index(repo_root: Path) -> tuple[set[str], set[str]]:
    """Return (covered_sources, covered_domains).

    covered_sources — normalized source paths declared via `# tested-source:`
                      headers (exact, the primary signal; includes ai_generated/).
    covered_domains — domain words from test filenames (fallback for legacy
                      tests without a header).
    """
    covered_sources: set[str] = set()
    covered_domains: set[str] = set()
    for test_dir in TEST_DIRS:
        test_path = repo_root / test_dir
        if not test_path.exists():
            continue
        for f in test_path.glob("test_*.py"):
            for src in read_tested_sources(f):
                covered_sources.add(normalize_source(src))
            domain = _DATE_SUFFIX.sub("", f.stem[len("test_"):])
            if domain:
                covered_domains.add(domain.replace("-", "_").lower())
    return covered_sources, covered_domains


def is_covered(path: str, covered_sources: set[str], covered_domains: set[str]) -> bool:
    if normalize_source(path) in covered_sources:
        return True
    domain = extract_domain_word(path)
    return bool(domain and domain in covered_domains)


# ── Report builder ────────────────────────────────────────────────────────────

def build_report(gaps: list[dict], mode: str, remaining: int) -> str:
    now = datetime.now(timezone.utc).isoformat()
    scope = "every API route (full-surface)" if mode == "all" else "API routes changed in the last 24h"
    lines = [
        "# Coverage Gaps Report",
        "",
        f"**Generated:** {now}",
        f"**Mode:** {mode} — scanning {scope}",
        f"**Gaps in this batch:** {len(gaps)} route(s) with no corresponding test",
    ]
    if remaining > 0:
        lines.append(f"**Remaining uncovered (not in this batch):** {remaining} "
                     f"— capped at {MAX_FILES}/run; the next run continues the backfill.")
    lines += ["", "---", ""]
    for g in gaps:
        lines += [
            f"## `{g['path']}`",
            "",
            f"**Add a test declaring:** `# tested-source: {g['path']}`",
            f"**Domain word:** `{g['domain']}`",
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
    parser.add_argument(
        "--all-routes", action="store_true",
        help="Full-surface backfill: scan every app/api route, not just recent changes.",
    )
    args = parser.parse_args()

    repo_root = Path(args.repo).resolve()
    mode = "all" if args.all_routes else "delta"

    if args.all_routes:
        candidates = get_all_route_files(repo_root)
    else:
        candidates = get_changed_source_files(repo_root, args.since)
    source_files = [f for f in candidates if is_source_file(f)]

    covered_sources, covered_domains = build_coverage_index(repo_root)

    uncovered = [p for p in source_files if not is_covered(p, covered_sources, covered_domains)]
    batch = uncovered[:MAX_FILES]
    remaining = len(uncovered) - len(batch)

    gaps: list[dict] = []
    for path in batch:
        gaps.append({
            "path": path,
            "domain": extract_domain_word(path) or "",
            "diff": get_diff_for_file(repo_root, path, MAX_DIFF_BYTES),
        })

    if not gaps:
        print(f"NO_GAPS: no uncovered API routes ({mode} mode)")
        sys.exit(0)

    report = build_report(gaps, mode, remaining)
    Path(args.output).write_text(report, encoding="utf-8")
    print(f"GAP_FOUND: {len(gaps)} gap(s) ({mode} mode, {remaining} remaining) written to {args.output}")
    sys.exit(0)


if __name__ == "__main__":
    main()
