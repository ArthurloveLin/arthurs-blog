"""
Post-run performance report for Locust CSV results.

Displays P50 / P75 / P95 / P99 per endpoint, plus an estimated real-world
latency column that subtracts the test-chain network overhead (GitHub
cloud runner → VPS round-trip). No pass/fail judgement — purely informational.

Usage:
    python tests/perf/thresholds.py --csv tests/perf/results_stats.csv
    python tests/perf/thresholds.py --csv tests/perf/results_stats.csv \\
        --markdown-out tests/perf/thresholds-summary.md

Exit code is always 0.
"""

import argparse
import csv
import sys
from pathlib import Path


# ── Test-chain network overhead ───────────────────────────────────────────────
# GitHub Actions ubuntu-latest runners run in Azure US-East.
# The VPS is in Asia (Singapore / Mumbai area).
# Measured one-way RTT ≈ 150–250 ms; use 200 ms as a conservative midpoint.
# "P95 est. actual" = P95 measured − this constant, giving an approximation
# of what a same-region user would observe under equivalent load.
NETWORK_OVERHEAD_MS = 200

# Locust stats CSV column names for each percentile
_PERC_COLS   = ["50%",  "75%",  "95%",  "99%"]
_PERC_LABELS = ["P50",  "P75",  "P95",  "P99"]


# ── Parsing ───────────────────────────────────────────────────────────────────

def _parse_stats(csv_path: Path) -> list[dict]:
    with open(csv_path, newline="") as f:
        return list(csv.DictReader(f))


def build_report(stats_file: str) -> tuple[list[dict], str | None]:
    path = Path(stats_file)
    if not path.exists():
        return [], f"Stats file not found: {path}"

    results = []
    for row in _parse_stats(path):
        name = row.get("Name", "?")
        if name == "Aggregated":
            continue

        try:
            failures = int(row.get("Failure Count", 0))
            requests = int(row.get("Request Count", 1))
        except (ValueError, KeyError):
            continue

        percentiles: dict[str, float] = {}
        for col, label in zip(_PERC_COLS, _PERC_LABELS):
            try:
                percentiles[label] = float(row.get(col) or 0)
            except (ValueError, TypeError):
                percentiles[label] = 0.0

        results.append({
            "name": name,
            "p": percentiles,
            "p95_actual_est": max(0.0, percentiles["P95"] - NETWORK_OVERHEAD_MS),
            "error_rate": failures / max(requests, 1),
            "requests": requests,
        })

    if not results:
        return [], f"No per-endpoint rows found in {path}"

    return results, None


# ── Stdout summary ────────────────────────────────────────────────────────────

def print_report(results: list[dict]) -> None:
    col_w = max((len(r["name"]) for r in results), default=8)
    header = f"{'Endpoint':<{col_w}}  {'P50':>7}  {'P75':>7}  {'P95':>7}  {'P99':>7}  {'P95 est.':>9}  {'Errors':>7}"
    print(header)
    print("-" * len(header))
    for r in results:
        p = r["p"]
        print(
            f"{r['name']:<{col_w}}"
            f"  {p['P50']:>6.0f}ms"
            f"  {p['P75']:>6.0f}ms"
            f"  {p['P95']:>6.0f}ms"
            f"  {p['P99']:>6.0f}ms"
            f"  {r['p95_actual_est']:>8.0f}ms"
            f"  {r['error_rate']:>6.2%}"
        )


# ── Markdown report ───────────────────────────────────────────────────────────

def write_markdown(output_path: Path, stats_file: str, results: list[dict], error_message: str | None) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    lines = [
        "### Performance Report",
        "",
        f"- Source: `{stats_file}`",
        f"- Test chain overhead: **{NETWORK_OVERHEAD_MS} ms** (GitHub cloud runner → VPS estimated RTT)",
        f"- **P95 est. actual** = P95 measured − {NETWORK_OVERHEAD_MS} ms &nbsp;*(approximates same-region user latency under load)*",
        "",
    ]

    if error_message:
        lines += [f"> ⚠️ {error_message}", ""]

    if results:
        lines += [
            "| Endpoint | P50 | P75 | P95 | P99 | P95 est. actual | Error rate |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
        for r in results:
            p = r["p"]
            lines.append(
                f"| {r['name']}"
                f" | {p['P50']:.0f} ms"
                f" | {p['P75']:.0f} ms"
                f" | {p['P95']:.0f} ms"
                f" | {p['P99']:.0f} ms"
                f" | {r['p95_actual_est']:.0f} ms"
                f" | {r['error_rate']:.2%} |"
            )
    else:
        lines.append("No per-endpoint data available.")

    output_path.write_text("\n".join(lines) + "\n")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Locust performance report (informational)")
    parser.add_argument("--csv", default="tests/perf/results_stats.csv", help="Locust stats CSV")
    parser.add_argument("--markdown-out", help="Write markdown summary to this path")
    args = parser.parse_args()

    results, error_message = build_report(args.csv)

    if error_message:
        print(f"[WARN] {error_message}")

    if results:
        print_report(results)

    if args.markdown_out:
        write_markdown(Path(args.markdown_out), args.csv, results, error_message)

    sys.exit(0)


if __name__ == "__main__":
    main()
