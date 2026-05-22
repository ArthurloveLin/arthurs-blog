"""
Parse pytest JUnit XML report (--junit-xml) and output a structured Markdown
document for AI analysis.

Usage:
  pytest --junit-xml=tests/ai_hooks/report.xml ...
  python tests/ai_hooks/format_report.py \\
      --input tests/ai_hooks/report.xml \\
      --output /tmp/failure-context.md

Output is written to stdout if --output is omitted.
"""

import argparse
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path


def build_markdown(xml_path: Path) -> str:
    tree = ET.parse(xml_path)
    root = tree.getroot()

    # JUnit XML root may be <testsuites> or <testsuite>
    if root.tag == "testsuites":
        suites = list(root)
    else:
        suites = [root]

    total = passed = failed = errored = skipped = 0
    duration = 0.0
    failures: list[dict] = []

    for suite in suites:
        total    += int(suite.get("tests",    0))
        failed   += int(suite.get("failures", 0))
        errored  += int(suite.get("errors",   0))
        skipped  += int(suite.get("skipped",  0))
        duration += float(suite.get("time",   0))

        for case in suite.iter("testcase"):
            fail = case.find("failure")
            err  = case.find("error")
            node = fail or err
            if node is not None:
                failures.append({
                    "name":    f"{case.get('classname', '')}.{case.get('name', '')}",
                    "outcome": "error" if err is not None else "failed",
                    "message": node.get("message", ""),
                    "detail":  (node.text or "").strip(),
                })

    passed = total - failed - errored - skipped
    created = datetime.now(timezone.utc).isoformat()

    lines = [
        "# Test Failure Report",
        "",
        f"**Generated:** {created}",
        f"**Duration:** {duration:.1f}s",
        f"**Total:** {total} | Passed: {passed} | Failed: {failed} | Error: {errored} | Skipped: {skipped}",
        "",
    ]

    if not failures:
        lines.append("✅ No failures to report.")
        return "\n".join(lines)

    lines.append(f"## Failed Tests ({len(failures)})")
    lines.append("")

    for t in failures:
        lines.append(f"### `{t['name']}`")
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
    parser = argparse.ArgumentParser(description="Format pytest JUnit XML report for AI analysis")
    parser.add_argument("--input",  required=True, help="Path to JUnit XML report (report.xml)")
    parser.add_argument("--output", default=None,  help="Output markdown file (stdout if omitted)")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"ERROR: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    markdown = build_markdown(input_path)

    if args.output:
        Path(args.output).write_text(markdown)
        print(f"Report written to {args.output}")
    else:
        print(markdown)


if __name__ == "__main__":
    main()
