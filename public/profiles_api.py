from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
import os
from pathlib import Path
import json
import re
from array import array

app = Flask(__name__)


def env_bool(name, default=False):
    raw = os.environ.get(name)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "on"}


def load_env_file():
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_env_file()

configured_origins = os.environ.get("FRONTEND_ORIGINS")
if configured_origins:
    env_origins = {origin.strip() for origin in configured_origins.split(",") if origin.strip()}
else:
    env_origins = {os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")}

allowed_origins = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    *env_origins,
}

cors_origins = "*" if "*" in allowed_origins else sorted(allowed_origins)
CORS(app, resources={r"/*": {"origins": cors_origins}})


@app.after_request
def ensure_cors_headers(response):
    # Explicit fallback for edge cases where proxies/CDNs mask default CORS behavior.
    request_origin = request.headers.get("Origin")
    if cors_origins == "*":
        response.headers["Access-Control-Allow-Origin"] = "*"
    elif request_origin and request_origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = request_origin
        response.headers["Vary"] = "Origin"

    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

_mongo_client = None

def get_db_client():
    global _mongo_client
    if _mongo_client is not None:
        return _mongo_client
    mongo_uri = os.environ.get("MONGODB_TARGET_URI")
    if not mongo_uri:
        raise RuntimeError(
            "Missing MONGODB_TARGET_URI environment variable. "
            "Set it in your shell or profiles-dashboard/.env."
        )
    print("Connecting to MongoDB")
    _mongo_client = MongoClient(mongo_uri)
    return _mongo_client


_profiles_cache = None
_chart_label_schema_cache = None
_answered_count_rows = None
_answered_counts = {}
_filter_index_rows = None
_filter_indexes = {}

def load_shared_constants():
    constants_path = Path(__file__).resolve().parent.parent / "shared" / "profile_constants.json"
    if not constants_path.exists():
        raise RuntimeError(f"Missing shared constants file: {constants_path}")
    return json.loads(constants_path.read_text(encoding="utf-8"))


SHARED_CONSTANTS = load_shared_constants()
FIXED_HEADERS = list(SHARED_CONSTANTS["FILTER_KEYS"])
ALLOWED_FILTER_KEYS = set(SHARED_CONSTANTS.get("FILTER_KEYS", FIXED_HEADERS))
IGNORE_FIELDS = set(SHARED_CONSTANTS["IGNORE_FIELDS"])
MIN_SLICE_PCT = float(SHARED_CONSTANTS["MIN_SLICE_PCT"])
DISPLAY_NAME_MAP = SHARED_CONSTANTS["DISPLAY_NAME_MAP"]
ZODIAC_ORDER = SHARED_CONSTANTS["ZODIAC_ORDER"]
STATE_POPULATION_ORDER = SHARED_CONSTANTS["STATE_POPULATION_ORDER"]

SORT_ORDERS = {
    "cannabis": ["Never", "Socially", "Frequently"],
    "drinking": ["Never", "Rarely", "Socially", "Frequently", "Sober"],
    "smoking": ["Never", "Socially", "Regularly"],
    "exercise": ["Almost never", "Sometimes", "Often", "Every day", "Active"],
    "education_level": ["High school", "Trade/tech school", "In college", "In grad school", "Undergraduate degree", "Graduate degree"],
    "politics": ["Liberal", "Moderate", "Conservative", "Apolitical"],
    "kids": ["Don't want", "Not sure yet", "Open to kids", "Has kids", "Want someday"],
    "looking_for": ["Relationship", "Marriage", "Something casual", "Don't know yet"],
}
SORT_ORDER_INDEX = {
    attr: {label: i for i, label in enumerate(order)}
    for attr, order in SORT_ORDERS.items()
}
STATE_POPULATION_INDEX = {label: i for i, label in enumerate(STATE_POPULATION_ORDER)}
ZODIAC_ORDER_INDEX = {label: i for i, label in enumerate(ZODIAC_ORDER)}

def get_profiles_cached():
    global _profiles_cache
    if _profiles_cache is not None:
        print("Serving profiles from cache")
        return _profiles_cache
    client = get_db_client()
    db_name = os.environ.get("MONGODB_CLEAN_DB", "Profiles_cleaned")
    collection_name = os.environ.get("MONGODB_COLLECTION", "Profiles")
    db = client[db_name]
    collection = db[collection_name]
    print("Fetching profiles from MongoDB")
    _profiles_cache = list(collection.find({}, {'_id': False}))
    print(f"Cached {len(_profiles_cache)} profiles")
    return _profiles_cache


def normalize_scalar(value):
    if value is None:
        return ""
    return str(value).strip()


def normalize_filter_values(raw):
    values = raw if isinstance(raw, list) else [raw]
    out = []
    for value in values:
        normalized = normalize_scalar(value)
        if normalized:
            out.append(normalized)
    return out


def normalize_filter_payload(incoming_filters):
    filters = {}
    for key, raw in incoming_filters.items():
        attr = normalize_scalar(key)
        if not attr or attr not in ALLOWED_FILTER_KEYS:
            continue
        values = normalize_filter_values(raw)
        if values:
            filters[attr] = values
    return filters


def count_non_blank(rows, attr):
    field = 'height_inches' if attr == 'height' else attr

    def has_value(row):
        value = row.get(field)
        return value is not None and value != ""

    global _answered_count_rows
    if rows is _profiles_cache:
        if _answered_count_rows is not rows:
            _answered_counts.clear()
            _answered_count_rows = rows
        if attr not in _answered_counts:
            _answered_counts[attr] = sum(1 for row in rows if has_value(row))
        return _answered_counts[attr]
    return sum(1 for row in rows if has_value(row))


def values_match(row_value, selected_value):
    selected = normalize_scalar(selected_value)
    stored = normalize_scalar(row_value)
    return bool(selected and stored and stored.lower() == selected.lower())


def parse_age_bucket_start(label):
    if label.startswith("<"):
        return float("-inf")
    if label.startswith(">"):
        return float("inf")
    m = re.match(r"^(\d+)-", label)
    return int(m.group(1)) if m else float("inf")


def format_inches(n):
    inches = round(n)
    ft = inches // 12
    inch = inches % 12
    return f"{ft}'{inch}\""


def parse_height_bucket_start(label):
    if label.startswith("<"):
        return float("-inf")
    if label.startswith(">"):
        return float("inf")
    m = re.match(r"^(\d+)'\s*(\d+)\"", label)
    if not m:
        return float("inf")
    return int(m.group(1)) * 12 + int(m.group(2))


def collapse_tails_no_other(entries, answered_count, kind):
    def is_small(count):
        return (count / answered_count) * 100 < MIN_SLICE_PCT

    low_end = -1
    for i, (_, c) in enumerate(entries):
        if is_small(c):
            low_end = i
        else:
            break

    high_start = len(entries)
    for i in range(len(entries) - 1, -1, -1):
        if is_small(entries[i][1]):
            high_start = i
        else:
            break

    if low_end == len(entries) - 1:
        return [e[0] for e in entries], [e[1] for e in entries]

    labels = []
    values = []

    if low_end >= 0:
        low_count = sum(c for _, c in entries[: low_end + 1])
        first_kept_label = entries[low_end + 1][0] if low_end + 1 < len(entries) else ""
        if kind == "age":
            start = parse_age_bucket_start(first_kept_label)
            labels.append(f"<{int(start)}" if start != float("inf") else "Low")
        else:
            start_in = parse_height_bucket_start(first_kept_label)
            labels.append(f"<{format_inches(start_in)}" if start_in != float("inf") else "Low")
        values.append(low_count)

    mid_start = low_end + 1
    mid_end = high_start - 1
    for i in range(mid_start, mid_end + 1):
        if 0 <= i < len(entries):
            labels.append(entries[i][0])
            values.append(entries[i][1])

    if high_start < len(entries):
        high_count = sum(c for _, c in entries[high_start:])
        last_kept_label = entries[high_start - 1][0] if high_start - 1 >= 0 else ""
        if kind == "age":
            start = parse_age_bucket_start(last_kept_label)
            labels.append(f">{int(start) + 4}" if start not in (float("inf"), float("-inf")) else "High")
        else:
            labels.append(">6'3")
        values.append(high_count)

    return labels, values


def prettify_attribute_name(attr):
    if attr in DISPLAY_NAME_MAP:
        return DISPLAY_NAME_MAP[attr]
    return attr.replace("_", " ").capitalize()


def count_attribute_values(rows, attr):
    field = {'age': 'age_bucket', 'height': 'height_bucket'}.get(attr, attr)
    counts = {}
    answered_count = 0

    for row in rows:
        value = row.get(field)
        if value is None:
            continue
        value = str(value)
        if not value.strip():
            continue

        counts[value] = counts.get(value, 0) + 1
        answered_count += 1

    return counts, answered_count


def sort_entries_for_attr(attr, entries):
    if attr == "age":
        entries.sort(key=lambda x: parse_age_bucket_start(x[0]))
    elif attr == "height":
        entries.sort(key=lambda x: parse_height_bucket_start(x[0]))
    elif attr == "star_sign":
        entries.sort(key=lambda x: ZODIAC_ORDER_INDEX.get(x[0], 999))
    elif attr == "location":
        entries.sort(key=lambda x: STATE_POPULATION_INDEX.get(x[0], 999))
    elif attr in SORT_ORDER_INDEX:
        order_index = SORT_ORDER_INDEX[attr]
        entries.sort(key=lambda x: order_index.get(x[0], 999))
    elif attr == "religion":
        entries.sort(key=lambda x: x[1], reverse=True)
    elif attr == "occupation":
        entries.sort(key=lambda x: x[0])
    else:
        entries.sort(key=lambda x: x[1], reverse=True)


def collapse_small_slices(entries, answered_count, *, keep_all=False, explicit_other_to_other=False):
    labels = []
    values = []

    if keep_all:
        for label, count in entries:
            labels.append(label)
            values.append(count)
        return labels, values

    other_count = 0
    for label, count in entries:
        pct = (count / answered_count) * 100
        is_explicit_other = (
            explicit_other_to_other
            and normalize_scalar(label).lower() == "other"
        )

        if is_explicit_other or pct < MIN_SLICE_PCT:
            other_count += count
        else:
            labels.append(label)
            values.append(count)

    if other_count > 0:
        labels.append("Other")
        values.append(other_count)

    return labels, values


def build_chart_label_schema(rows, headers):
    schema = {}

    for attr in headers:
        if not attr or attr in IGNORE_FIELDS or attr in {"age", "height"}:
            continue

        counts, answered_count = count_attribute_values(rows, attr)
        if answered_count == 0:
            continue

        entries = list(counts.items())
        sort_entries_for_attr(attr, entries)

        labels, _ = collapse_small_slices(
            entries,
            answered_count,
            keep_all=attr in {"star_sign", "looking_for", "kids"},
            explicit_other_to_other=attr == "religion",
        )

        schema[attr] = labels

    return schema


def get_chart_label_schema_cached():
    global _chart_label_schema_cache
    if _chart_label_schema_cache is not None:
        return _chart_label_schema_cache

    all_rows = get_profiles_cached()
    _chart_label_schema_cache = build_chart_label_schema(all_rows, FIXED_HEADERS)
    return _chart_label_schema_cache


def build_attribute_charts(rows, headers, label_schema=None):
    counts_by_attribute = {
        attr: count_attribute_values(rows, attr)
        for attr in headers if attr and attr not in IGNORE_FIELDS
    }
    return build_attribute_charts_from_counts(counts_by_attribute, headers, label_schema)


def build_attribute_charts_from_counts(counts_by_attribute, headers, label_schema=None):
    charts = []

    for attr in headers:
        if not attr or attr in IGNORE_FIELDS:
            continue

        is_age = attr == "age"
        is_height = attr == "height"

        counts, answered_count = counts_by_attribute.get(attr, ({}, 0))

        if answered_count == 0:
            continue

        entries = list(counts.items())
        sort_entries_for_attr(attr, entries)

        labels = []
        values = []
        if is_age or is_height:
            labels, values = collapse_tails_no_other(entries, answered_count, "age" if is_age else "height")
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
        else:
            labels, values = collapse_small_slices(
                entries,
                answered_count,
                keep_all=attr in {"star_sign", "looking_for", "kids"},
                explicit_other_to_other=attr == "religion",
            )

        charts.append({
            "attribute": attr,
            "title": prettify_attribute_name(attr),
            "answeredCount": answered_count,
            "labels": labels,
            "values": values,
        })

    return charts


def matches_age_filter(age_value, selected_label):
    try:
        n = int(str(age_value).strip())
    except Exception:
        return False

    label = str(selected_label).strip()
    range_m = re.match(r"^(\d{1,3})-(\d{1,3})$", label)
    if range_m:
        low = int(range_m.group(1))
        high = int(range_m.group(2))
        return low <= n <= high

    lt_m = re.match(r"^<(\d{1,3})$", label)
    if lt_m:
        return n < int(lt_m.group(1))

    gt_m = re.match(r"^>(\d{1,3})$", label)
    if gt_m:
        return n > int(gt_m.group(1))

    try:
        exact = int(label)
        return n == exact
    except Exception:
        pass

    return False


def parse_feet_inches(text):
    m = re.match(r"^(\d+)\s*'\s*(\d+)\"$", str(text).strip())
    if not m:
        return None
    return int(m.group(1)) * 12 + int(m.group(2))


def matches_height_inches_filter(inches, selected_label):
    if inches is None:
        return False

    label = str(selected_label).strip()
    range_m = re.match(r"^(\d+\s*'\s*\d+\")-(\d+\s*'\s*\d+\")$", label)
    if range_m:
        low = parse_feet_inches(range_m.group(1))
        high = parse_feet_inches(range_m.group(2))
        return low is not None and high is not None and low <= inches <= high

    lt_m = re.match(r"^<(\d+\s*'\s*\d+\")$", label)
    if lt_m:
        bound = parse_feet_inches(lt_m.group(1))
        return bound is not None and inches < bound

    gt_m = re.match(r"^>(\d+\s*'\s*\d+\")$", label)
    if gt_m:
        bound = parse_feet_inches(gt_m.group(1))
        return bound is not None and inches > bound

    exact = parse_feet_inches(label)
    return exact is not None and round(inches) == exact


def filter_index(rows, attr):
    global _filter_index_rows
    if _filter_index_rows is not rows:
        _filter_indexes.clear()
        _filter_index_rows = rows
    if attr not in _filter_indexes:
        index = {}
        for position, row in enumerate(rows):
            value = row.get('height_inches' if attr == 'height' else attr)
            key = value if attr == 'height' else normalize_scalar(value)
            index.setdefault(key, array('I')).append(position)
        _filter_indexes[attr] = index
    return _filter_indexes[attr]


def indexed_filters(rows, filters):
    matches = None
    for attr, raw_values in filters.items():
        values = normalize_filter_values(raw_values)
        if not values:
            continue
        positions = set()
        for value, indexed_positions in filter_index(rows, attr).items():
            if attr == 'age':
                matched = any(matches_age_filter(value, selected) for selected in values)
            elif attr == 'height':
                matched = any(matches_height_inches_filter(value, selected) for selected in values)
            else:
                matched = any(values_match(value, selected) for selected in values)
            if matched:
                positions.update(indexed_positions)
        matches = positions if matches is None else matches.intersection(positions)
        if not matches:
            return []
    return [rows[position] for position in sorted(matches)] if matches is not None else rows


def apply_filters(rows, filters):
    if not filters:
        return rows

    if rows is _profiles_cache:
        return indexed_filters(rows, filters)

    def build_attr_predicate(attr, raw_val):
        values = tuple(normalize_filter_values(raw_val))
        if not values:
            return None

        if attr == "age":
            def predicate(row):
                row_value = row.get(attr)
                return any(matches_age_filter(row_value, val) for val in values)
            return predicate

        if attr == "height":
            def predicate(row):
                return any(matches_height_inches_filter(row.get('height_inches'), val) for val in values)
            return predicate

        def predicate(row):
            row_value = row.get(attr)
            return any(values_match(row_value, val) for val in values)

        return predicate

    predicates = []
    for attr, raw_val in filters.items():
        predicate = build_attr_predicate(attr, raw_val)
        if predicate is not None:
            predicates.append(predicate)

    if not predicates:
        return rows

    out = []
    for row in rows:
        if all(predicate(row) for predicate in predicates):
            out.append(row)
    return out


def compute_delusion_pct(all_rows, filtered_rows, filters):
    if not filters:
        return 0.0

    min_answered = None
    min_attr = None
    for attr in filters.keys():
        answered = count_non_blank(all_rows, attr)
        if min_answered is None or answered < min_answered:
            min_answered = answered
            min_attr = attr

    if not min_answered or min_answered <= 0:
        return 0.0

    filtered_answered = count_non_blank(filtered_rows, min_attr)

    raw_delusion = 100 * (1 - (filtered_answered / min_answered))
    if len(filtered_rows) == 0:
        return 100.0
    return min(99.9, max(0.0, raw_delusion))


def calculate_summary(filters, all_rows, label_schema):
    filtered_rows = apply_filters(all_rows, filters)
    return {
        'charts': build_attribute_charts(filtered_rows, FIXED_HEADERS, label_schema=label_schema),
        'filteredCount': len(filtered_rows),
        'totalCount': len(all_rows),
        'delusionPct': compute_delusion_pct(all_rows, filtered_rows, filters),
    }


@app.route('/')
def index():
    return jsonify({
        "status": "ok",
        "service": "delusionmeter-api",
        "endpoints": ["/profiles", "/health"],
    })


@app.route('/health')
def health():
    return jsonify({"status": "ok"})


@app.route('/summary', methods=['GET', 'POST'])
def get_summary():
    payload = request.get_json(silent=True) if request.method == 'POST' else None
    payload = payload or {}
    incoming_filters = payload.get('filter') or payload.get('filters') or {}
    filters = normalize_filter_payload(incoming_filters)

    all_rows = get_profiles_cached()
    label_schema = get_chart_label_schema_cached()
    return jsonify(calculate_summary(filters, all_rows, label_schema))

@app.route('/profiles')
def get_profiles():
    docs = get_profiles_cached()
    return jsonify(docs)

if __name__ == '__main__':
    app.run(debug=env_bool("FLASK_DEBUG", default=False))