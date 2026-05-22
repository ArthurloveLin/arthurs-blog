"""
Parse one or more pytest JUnit XML reports (--junit-xml) and output a combined
structured Markdown document for AI analysis.

Usage:
  pytest --junit-xml=tests/ai_hooks/report.xml ...
  python tests/ai_hooks/format_report.py \\
      --input tests/ai_hooks/report.xml [tests/ai_hooks/infra-report.xml ...] \\
      --output /tmp/failure-context.md

Multiple --input files are merged into a single report. Missing files are
skipped with a warning (no error) so the workflow survives partial artifact
downloads.

Output is written to stdout if --output is omitted.
"""

import argparse
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path


def _parse_xml(xml_path: Path) -> list[dict]:
    """Return list of failure dicts from a JUnit XML file."""
    tree = ET.parse(xml_path)
    root = tree.getroot()
    suites = list(root) if root.tag == "testsuites" else [root]

    results = {"total": 0, "failed": 0, "errored": 0, "skipped": 0, "duration": 0.0}
    failures: list[dict] = []

    for suite in suites:
        results["total"]    += int(suite.get("tests",    0))
        results["failed"]   += int(suite.get("failures", 0))
        results["errored"]  += int(suite.get("errors",   0))
        results["skipped"]  += int(suite.get("skipped",  0))
        results["duration"] += float(suite.get("time",   0))

        for case in suite.iter("testcase"):
            fail = case.find("failure")
            err  = case.find("error")
            node = fail if fail is not None else err
            if node is not None:
                failures.append({
                    "source":  xml_path.name,
                    "name":    f"{case.get('classname', '')}.{case.get('name', '')}",
                    "outcome": "error" if err is not None else "failed",
                    "message": node.get("message", ""),
                    "detail":  (node.text or "").strip(),
                })

    return results, failures


def build_markdown(xml_paths: list[Path]) -> str:
    created = datetime.now(timezone.utc).isoformat()
    total = failed = errored = skipped = 0
    duration = 0.0
    all_failures: list[dict] = []
    parsed_sources: list[str] = []

    for p in xml_paths:
        if not p.exists():
            print(f"WARNING: skipping missing file: {p}", file=sys.stderr)
            continue
        results, failures = _parse_xml(p)
        total    += results["total"]
        failed   += results["failed"]
        errored  += results["errored"]
        skipped  += results["skipped"]
        duration += results["duration"]
        all_failures.extend(failures)
        parsed_sources.append(p.name)

    if not parsed_sources:
        return (
            "# Test Failure Report\n\n"
            f"**Generated:** {created}\n\n"
            "No JUnit XML reports were available. Check CI logs for details.\n"
        )

    passed = total - failed - errored - skipped
    sources_str = ", ".join(f"`{s}`" for s in parsed_sources)

    lines = [
        "# Test Failure Report",
        "",
        f"**Generated:** {created}",
        f"**Sources:** {sources_str}",
        f"**Duration:** {duration:.1f}s",
        f"**Total:** {total} | Passed: {passed} | Failed: {failed} | Error: {errored} | Skipped: {skipped}",
        "",
    ]

    if not all_failures:
        lines.append("✅ No failures to report.")
        return "\n".join(lines)

    lines.append(f"## Failed Tests ({len(all_failures)})")
    lines.append("")

    for t in all_failures:
        lines.append(f"### `{t['name']}` *(from {t['source']})*")
        lines.append(f"**Outcome:** {t['outcome']}")
        if t["message"]:
            lines.append(f"**Message:** {t['message'][:300]}")
        if t["detail"]:
            lines.append("\n**Detail:**")
            lines.append("```")
            lines.append(t["detail"][:2000])
            lines.append("```")
        lines.append("")

    lines += [
        "---",
        "## Suggested Analysis Questions",
        "",
        "1. Are these failures new (regression) or pre-existing?",
        "2. Do multiple failures share a common root cause (e.g., auth, network, test data)?",
        "3. Is there a setup/teardown fixture that may have failed first?",
        "4. Could this be a timing issue (slow container startup, network timeout)?",
        "5. What changed in the latest commit that could cause these failures?",
    ]

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Format pytest JUnit XML report(s) for AI analysis")
    parser.add_argument("--input",  required=True, nargs="+", help="JUnit XML report file(s)")
    parser.add_argument("--output", default=None,  help="Output markdown file (stdout if omitted)")
    args = parser.parse_args()

    markdown = build_markdown([Path(p) for p in args.input])

    if args.output:
        Path(args.output).write_text(markdown)
        print(f"Report written to {args.output}")
    else:
        print(markdown)


if __name__ == "__main__":
    main()
