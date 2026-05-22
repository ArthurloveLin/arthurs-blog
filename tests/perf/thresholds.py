"""
Post-run threshold checker for Locust CSV results.

Called after locust --csv=tests/perf/results to enforce SLOs:
  - p95 response time < 1000ms (public internet, includes network RTT)
  - error rate < 1%

Usage:
  python tests/perf/thresholds.py --csv tests/perf/results

Exit code 0 = all thresholds passed, 1 = failure (CI will fail the job).
"""

import argparse
import csv
import sys
from pathlib import Path


P95_THRESHOLD_MS = 1000
ERROR_RATE_THRESHOLD = 0.01  # 1%


def parse_stats(csv_path: Path) -> list[dict]:
    rows = []
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def check_thresholds(stats_file: str) -> bool:
    path = Path(stats_file)
    if not path.exists():
        print(f"[FAIL] Stats file not found: {path}")
        return False

    rows = parse_stats(path)
    passed = True

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

        if p95 > P95_THRESHOLD_MS:
            print(f"[FAIL] {name}: p95={p95:.0f}ms > threshold={P95_THRESHOLD_MS}ms")
            passed = False
        else:
            print(f"[PASS] {name}: p95={p95:.0f}ms")

        if error_rate > ERROR_RATE_THRESHOLD:
            print(f"[FAIL] {name}: error_rate={error_rate:.1%} > threshold={ERROR_RATE_THRESHOLD:.1%}")
            passed = False
        else:
            print(f"[PASS] {name}: error_rate={error_rate:.1%}")

    return passed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", default="tests/perf/results_stats.csv", help="Locust stats CSV file")
    args = parser.parse_args()

    ok = check_thresholds(args.csv)
    if not ok:
        print("\n[FAIL] Performance thresholds not met.")
        sys.exit(1)
    print("\n[PASS] All performance thresholds met.")
    sys.exit(0)


if __name__ == "__main__":
    main()
