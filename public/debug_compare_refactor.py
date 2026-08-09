"""Parity checker for backend refactors.

Runs legacy (pre-refactor) logic and current logic side-by-side on the same data,
then reports mismatches for filtered counts and summary chart payloads.

Usage:
  cd profiles-dashboard/public
  python debug_compare_refactor.py
"""

from __future__ import annotations

import argparse
import json
import random
from typing import Dict, List, Tuple

import profiles_api as p


def legacy_apply_filters(rows, filters):
    if not filters:
        return rows

    out = []
    for row in rows:
        keep = True
        for attr, raw_val in filters.items():
            values = p.normalize_filter_values(raw_val)
            if not values:
                continue

            if attr == "age":
                if not any(p.matches_age_filter(row.get(attr), val) for val in values):
                    keep = False
                    break
                continue

            if attr == "height":
                if not any(p.matches_height_filter(row.get(attr), val) for val in values):
                    keep = False
                    break
                continue

            if not any(p.values_match(attr, row.get(attr), val) for val in values):
                keep = False
                break

        if keep:
            out.append(row)
    return out


def legacy_build_chart_label_schema(rows, headers):
    schema = {}

    for attr in headers:
        if not attr or attr in p.IGNORE_FIELDS or attr in {"age", "height"}:
            continue

        counts, answered_count = p.count_attribute_values(rows, attr)
        if answered_count == 0:
            continue

        entries = list(counts.items())
        p.sort_entries_for_attr(attr, entries)

        labels = []
        if attr in {"star_sign", "looking_for", "kids"}:
            labels = [l for l, _ in entries]
        elif attr == "religion":
            other_count = 0
            for label, count in entries:
                pct = (count / answered_count) * 100
                is_explicit_other = str(label).strip().lower() == "other"
                if is_explicit_other or pct < p.MIN_SLICE_PCT:
                    other_count += count
                else:
                    labels.append(label)
            if other_count > 0:
                labels.append("Other")
        else:
            other_count = 0
            for label, count in entries:
                pct = (count / answered_count) * 100
                if pct < p.MIN_SLICE_PCT:
                    other_count += count
                else:
                    labels.append(label)
            if other_count > 0:
                labels.append("Other")

        schema[attr] = labels

    return schema


def legacy_build_attribute_charts(rows, headers, label_schema=None):
    charts = []

    for attr in headers:
        if not attr or attr in p.IGNORE_FIELDS:
            continue

        is_age = attr == "age"
        is_height = attr == "height"

        counts, answered_count = p.count_attribute_values(rows, attr)

        if answered_count == 0:
            continue

        entries = list(counts.items())
        p.sort_entries_for_attr(attr, entries)

        labels = []
        values = []
        if is_age or is_height:
            labels, values = p.collapse_tails_no_other(entries, answered_count, "age" if is_age else "height")
        elif label_schema and attr in label_schema:
            labels = list(label_schema[attr])
            fixed_counts = {label: 0 for label in labels}
            has_other = "Other" in fixed_counts

            for label, count in entries:
                if label in fixed_counts:
                    fixed_counts[label] += count
                elif has_other:
                    fixed_counts["Other"] += count

            values = [fixed_counts[label] for label in labels]
            answered_count = sum(values)
        elif attr in {"star_sign", "looking_for", "kids"}:
            labels = [l for l, _ in entries]
            values = [c for _, c in entries]
        elif attr == "religion":
            other_count = 0
            for label, count in entries:
                pct = (count / answered_count) * 100
                is_explicit_other = str(label).strip().lower() == "other"
                if is_explicit_other or pct < p.MIN_SLICE_PCT:
                    other_count += count
                else:
                    labels.append(label)
                    values.append(count)
            if other_count > 0:
                labels.append("Other")
                values.append(other_count)
        else:
            other_count = 0
            for label, count in entries:
                pct = (count / answered_count) * 100
                if pct < p.MIN_SLICE_PCT:
                    other_count += count
                else:
                    labels.append(label)
                    values.append(count)
            if other_count > 0:
                labels.append("Other")
                values.append(other_count)

        charts.append(
            {
                "attribute": attr,
                "title": p.prettify_attribute_name(attr),
                "answeredCount": answered_count,
                "labels": labels,
                "values": values,
            }
        )

    return charts


def normalize_chart_payload(charts: List[Dict]) -> Dict[str, Dict]:
    out = {}
    for chart in charts:
        out[chart["attribute"]] = {
            "answeredCount": chart["answeredCount"],
            "labels": list(chart["labels"]),
            "values": list(chart["values"]),
        }
    return out


def pick_random_filters(all_rows: List[Dict], max_attrs: int = 3) -> Dict[str, List[str]]:
    attrs = [a for a in p.FIXED_HEADERS if a not in p.IGNORE_FIELDS and a not in {"occupation"}]
    random.shuffle(attrs)
    chosen = attrs[: random.randint(1, max_attrs)]

    out = {}
    for attr in chosen:
        values = sorted(
            {
                p.normalize_scalar(row.get(attr))
                for row in all_rows
                if p.normalize_scalar(row.get(attr))
            }
        )
        if not values:
            continue
        sample_count = random.randint(1, min(2, len(values)))
        out[attr] = random.sample(values, sample_count)
    return out


def compare_once(
    all_rows: List[Dict],
    filters: Dict[str, List[str]],
    legacy_schema: Dict[str, List[str]],
    current_schema: Dict[str, List[str]],
) -> Tuple[bool, Dict]:
    legacy_rows = legacy_apply_filters(all_rows, filters)
    current_rows = p.apply_filters(all_rows, filters)

    legacy_charts = legacy_build_attribute_charts(legacy_rows, p.FIXED_HEADERS, label_schema=legacy_schema)
    current_charts = p.build_attribute_charts(current_rows, p.FIXED_HEADERS, label_schema=current_schema)

    legacy_payload = {
        "filteredCount": len(legacy_rows),
        "delusionPct": p.compute_delusion_pct(all_rows, legacy_rows, filters),
        "charts": normalize_chart_payload(legacy_charts),
    }
    current_payload = {
        "filteredCount": len(current_rows),
        "delusionPct": p.compute_delusion_pct(all_rows, current_rows, filters),
        "charts": normalize_chart_payload(current_charts),
    }

    return legacy_payload == current_payload, {
        "filters": filters,
        "legacy": legacy_payload,
        "current": current_payload,
    }


def parse_args():
    parser = argparse.ArgumentParser(description="Compare legacy vs current backend logic parity.")
    parser.add_argument(
        "--cases",
        type=int,
        default=40,
        help="Number of randomized filter cases to run in addition to fixed sanity cases.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=7,
        help="Random seed used for randomized case generation.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Print only final PASS/FAIL summary.",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=0,
        help="If > 0, sample up to this many decoded rows to speed up checks.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    random.seed(args.seed)
    all_rows = p.decode_profiles_cached()

    if args.max_rows and args.max_rows > 0 and len(all_rows) > args.max_rows:
        all_rows = random.sample(all_rows, args.max_rows)

    # Expensive: compute once per run from the same row set for fair comparison.
    legacy_schema = legacy_build_chart_label_schema(all_rows, p.FIXED_HEADERS)
    current_schema = p.build_chart_label_schema(all_rows, p.FIXED_HEADERS)

    # Include a few fixed sanity cases plus randomized cases.
    cases = [
        {},
        {"cannabis": ["Socially"]},
        {"drinking": ["Never"]},
        {"age": ["26-30"]},
        {"height": ["5'8\"-5'11\""]},
        {"religion": ["Christian"]},
        {"politics": ["Liberal", "Moderate"]},
    ]
    for _ in range(max(0, args.cases)):
        cases.append(pick_random_filters(all_rows))

    mismatches = []
    for i, filters in enumerate(cases, start=1):
        ok, details = compare_once(all_rows, filters, legacy_schema, current_schema)
        if not ok:
            mismatches.append((i, details))

    if not mismatches:
        print(f"PASS: {len(cases)} cases matched legacy and current behavior.")
        return

    print(f"FAIL: {len(mismatches)} mismatches out of {len(cases)} cases.")
    if args.quiet:
        return

    # Print first mismatch only to keep output readable.
    idx, details = mismatches[0]
    print(f"First mismatch case #{idx}")
    print("Filters:", json.dumps(details["filters"], indent=2, ensure_ascii=False))
    print("Legacy summary:", json.dumps({
        "filteredCount": details["legacy"]["filteredCount"],
        "delusionPct": details["legacy"]["delusionPct"],
    }, indent=2, ensure_ascii=False))
    print("Current summary:", json.dumps({
        "filteredCount": details["current"]["filteredCount"],
        "delusionPct": details["current"]["delusionPct"],
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
