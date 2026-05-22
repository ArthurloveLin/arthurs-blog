"""
Post-run threshold checker for Locust CSV results.

Called after locust --csv=tests/perf/results to enforce SLOs:
    - p95 response time < 1000ms (public internet, includes network RTT)
    - error rate < 1%

Usage:
    python tests/perf/thresholds.py --csv tests/perf/results
    python tests/perf/thresholds.py --csv tests/perf/results --markdown-out tests/perf/thresholds-summary.md --no-fail

Exit code 0 = all thresholds passed, 1 = failure (unless --no-fail is set).
"""

import argparse
import csv
import sys
from pathlib import Path


P95_THRESHOLD_MS = 1000
ERROR_RATE_THRESHOLD = 0.01  # 1%

# Per-endpoint overrides (substring match on Name column)
P95_OVERRIDES: dict[str, int] = {
    "/api/blog/search": 4000,  # full-text search hits Supabase; slower under load
}


def parse_stats(csv_path: Path) -> list[dict]:
    rows = []
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def evaluate_thresholds(stats_file: str) -> tuple[bool, list[dict[str, object]], str | None]:
    path = Path(stats_file)
    if not path.exists():
        message = f"Stats file not found: {path}"
        print(f"[FAIL] {message}")
        return False, [], message

    rows = parse_stats(path)
    passed = True
    results: list[dict[str, object]] = []

    for row in rows:
        name = row.get("Name", "?")
        if name == "Aggregated":
            continue  # check per-endpoint, not aggregate

        try:
            p95 = float(row.get("95%", 0))
            failures = int(row.get("Failure Count", 0))
            requests = int(row.get("Request Count", 1))
        except (ValueError, KeyError):
            continue

        error_rate = failures / max(requests, 1)

        p95_limit = next(
            (v for k, v in P95_OVERRIDES.items() if k in name),
            P95_THRESHOLD_MS,
        )
        p95_ok = p95 <= p95_limit
        error_rate_ok = error_rate <= ERROR_RATE_THRESHOLD

        results.append(
            {
                "name": name,
                "p95": p95,
                "p95_limit": p95_limit,
                "p95_ok": p95_ok,
                "error_rate": error_rate,
                "error_rate_limit": ERROR_RATE_THRESHOLD,
                "error_rate_ok": error_rate_ok,
            }
        )

        if not p95_ok:
            print(f"[FAIL] {name}: p95={p95:.0f}ms > threshold={p95_limit}ms")
            passed = False
        else:
            print(f"[PASS] {name}: p95={p95:.0f}ms")

        if not error_rate_ok:
            print(f"[FAIL] {name}: error_rate={error_rate:.1%} > threshold={ERROR_RATE_THRESHOLD:.1%}")
            passed = False
        else:
            print(f"[PASS] {name}: error_rate={error_rate:.1%}")

    if not results:
        message = f"No per-endpoint rows found in {path}"
        print(f"[FAIL] {message}")
        return False, [], message

    return passed, results, None


def write_markdown_summary(
    output_path: Path,
    stats_file: str,
    passed: bool,
    results: list[dict[str, object]],
    error_message: str | None,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    lines = [
        "### Threshold Summary",
        "",
        f"- Source CSV: {stats_file}",
        f"- Overall: {'PASS' if passed else 'WARN'}",
    ]

    if error_message:
        lines.append(f"- Note: {error_message}")

    if results:
        lines.extend(
            [
                "",
                "| Endpoint | P95 | Limit | P95 status | Error rate | Limit | Error status |",
                "| --- | ---: | ---: | --- | ---: | ---: | --- |",
            ]
        )

        for result in results:
            lines.append(
                "| {name} | {p95:.0f} ms | {p95_limit} ms | {p95_status} | {error_rate:.2%} | {error_rate_limit:.2%} | {error_status} |".format(
                    name=result["name"],
                    p95=result["p95"],
                    p95_limit=result["p95_limit"],
                    p95_status="PASS" if result["p95_ok"] else "FAIL",
                    error_rate=result["error_rate"],
                    error_rate_limit=result["error_rate_limit"],
                    error_status="PASS" if result["error_rate_ok"] else "FAIL",
                )
            )
    else:
        lines.extend(["", "No per-endpoint rows were available to summarize."])

    output_path.write_text("\n".join(lines) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default="tests/perf/results_stats.csv", help="Locust stats CSV file")
    parser.add_argument("--markdown-out", help="Optional markdown summary output path")
    parser.add_argument("--no-fail", action="store_true", help="Always exit 0 after reporting")
    args = parser.parse_args()

    ok, results, error_message = evaluate_thresholds(args.csv)
    if args.markdown_out:
        write_markdown_summary(Path(args.markdown_out), args.csv, ok, results, error_message)

    if not ok:
        print("\n[FAIL] Performance thresholds not met.")
        if args.no_fail:
            print("[INFO] --no-fail enabled; reporting completed without failing the caller.")
            sys.exit(0)
        sys.exit(1)
    print("\n[PASS] All performance thresholds met.")
    sys.exit(0)


if __name__ == "__main__":
    main()
