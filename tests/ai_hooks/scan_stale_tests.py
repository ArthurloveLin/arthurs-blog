#!/usr/bin/env python3
"""
Scan tests/ai_generated/ for test files whose source modules no longer exist.

A test file is stale when:
  1. It has a "# tested-source: <path>" header and that path doesn't exist, OR
  2. It has no header and its domain word (from filename) doesn't match any
     source path segment under app/api/ or lib/.

Outputs:
  --output <path>       markdown report (written only when stale files found)
  --list-output <path>  one relative path per line (for bash deletion loop)

Usage:
    python tests/ai_hooks/scan_stale_tests.py --repo . \\
        --output /tmp/stale-tests.md --list-output /tmp/stale-file-list.txt
"""

import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


def read_tested_source(file_path: Path) -> str | None:
    """Extract '# tested-source: <path>' from the first 5 lines."""
    try:
        with open(file_path, encoding="utf-8") as f:
            for i, line in enumerate(f):
                if i >= 5:
                    break
                m = re.match(r"#\s*tested-source:\s*(.+)", line.strip())
                if m:
                    return m.group(1).strip()
    except OSError:
        pass
    return None


def extract_domain(stem: str) -> str:
    """
    Strip test_ prefix and optional _YYYYMMDD suffix.

    test_executor_20260528     → executor
    test_memo_habits_server_20260529 → memo_habits_server
    test_changelog_20260525    → changelog
    """
    name = re.sub(r"^test_", "", stem)
    name = re.sub(r"_\d{8}$", "", name)
    return name


def source_exists(repo_root: Path, domain: str) -> tuple[bool, str | None]:
    """
    Return (exists, matched_rel_path).

    Checks whether any file under app/api/ or lib/ has `domain` (or its
    hyphen variant) as a path segment or filename stem.  This handles:
      - app/api/changelog/route.ts      (changelog → segment match)
      - app/api/memo/check-reminders/   (memo → segment match)
      - lib/ntfy.ts                     (ntfy → stem match)
      - lib/memo-habits-server.ts       (memo_habits_server → hyphen match)
    """
    hyphen = domain.replace("_", "-")
    variants = {domain, hyphen}

    for src_dir in ["app/api", "lib"]:
        src_path = repo_root / src_dir
        if not src_path.exists():
            continue
        for f in src_path.rglob("*.ts"):
            rel = f.relative_to(repo_root)
            # Compare each path segment and the stem of the final component
            segments = set(rel.parts[:-1]) | {rel.stem}
            if segments & variants:
                return True, str(rel)

    return False, None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".", help="Path to git repo root")
    parser.add_argument("--output", default="/tmp/stale-tests.md",
                        help="Markdown report output path")
    parser.add_argument("--list-output", default="/tmp/stale-file-list.txt",
                        help="Plain file list output path (one path per line)")
    args = parser.parse_args()

    repo_root = Path(args.repo).resolve()
    test_dir = repo_root / "tests" / "ai_generated"

    if not test_dir.exists():
        print("NO_STALE: tests/ai_generated/ does not exist")
        sys.exit(0)

    stale: list[dict] = []

    for test_file in sorted(test_dir.glob("test_*.py")):
        rel = str(test_file.relative_to(repo_root))
        tested_source = read_tested_source(test_file)

        if tested_source:
            if not (repo_root / tested_source).exists():
                stale.append({
                    "file": rel,
                    "reason": f"# tested-source: {tested_source} — file not found",
                })
        else:
            domain = extract_domain(test_file.stem)
            exists, _ = source_exists(repo_root, domain)
            if not exists:
                stale.append({
                    "file": rel,
                    "reason": f"domain '{domain}' — no matching segment in app/api/ or lib/",
                })

    if not stale:
        print("NO_STALE: all AI-generated test files have matching source files")
        sys.exit(0)

    now = datetime.now(timezone.utc).isoformat()
    lines = [
        "# Stale AI-Generated Tests",
        "",
        f"**Scanned:** {now}",
        f"**Stale files:** {len(stale)}",
        "",
        "---",
        "",
    ]
    for entry in stale:
        lines += [
            f"## `{entry['file']}`",
            "",
            f"**Reason:** {entry['reason']}",
            "",
        ]

    Path(args.output).write_text("\n".join(lines), encoding="utf-8")
    Path(args.list_output).write_text(
        "\n".join(e["file"] for e in stale) + "\n", encoding="utf-8"
    )

    print(f"STALE_FOUND: {len(stale)} stale test file(s)")
    for entry in stale:
        print(f"STALE_FILE: {entry['file']}")
    sys.exit(0)


if __name__ == "__main__":
    main()
