from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
import os
from pathlib import Path
import re

app = Flask(__name__)


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
    mongo_uri = os.environ.get("MONGODB_URI")
    if not mongo_uri:
        raise RuntimeError(
            "Missing MONGODB_URI environment variable. "
            "Set it in your shell or profiles-dashboard/.env."
        )
    print("Connecting to MongoDB")
    _mongo_client = MongoClient(mongo_uri)
    return _mongo_client


_profiles_cache = None
_decoded_profiles_cache = None
_chart_label_schema_cache = None

ATTRIBUTE_MAP = {
    "1": "age",
    "2": "cannabis",
    "3": "drinking",
    "4": "education_level",
    "5": "exercise",
    "6": "gender",
    "7": "height",
    "8": "kids",
    "9": "location",
    "10": "looking_for",
    "11": "occupation",
    "12": "politics",
    "13": "religion",
    "14": "smoking",
    "15": "star_sign",
}

FIXED_HEADERS = list(ATTRIBUTE_MAP.values())

VALUE_MAPS = {
    "education_level": {1: "Undergraduate degree", 2: "In college", 3: "High school", 4: "Graduate degree", 5: "Trade/tech school", 6: "In grad school"},
    "gender": {1: "Man", 2: "Woman", 3: "Non-binary/Gender Nonconforming"},
    "height": {
        i + 1: f"{((i + 1 - 1) // 12) + 3}' {((i + 1 - 1) % 12)}''"
        for i in range(49)
    },
    "religion": {1: "Agnostic", 2: "Atheist", 3: "Buddhist", 4: "Catholic", 5: "Christian", 6: "Hindu", 7: "Jain", 8: "Jewish", 9: "Latter-day Saint", 10: "Mormon", 11: "Muslim", 12: "Other", 13: "Sikh", 14: "Spiritual", 15: "Zoroastrian"},
    "kids": {1: "Don't want", 2: "Not sure yet", 3: "Open to kids", 4: "Has kids", 5: "Want someday"},
    "exercise": {1: "Almost never", 2: "Sometimes", 3: "Often", 4: "Every day", 5: "Active"},
    "location": {
        1: "Alabama", 2: "Alaska", 3: "Arizona", 4: "Arkansas", 5: "California", 6: "Colorado", 7: "Connecticut", 8: "Delaware", 9: "Florida", 10: "Georgia",
        11: "Hawaii", 12: "Idaho", 13: "Illinois", 14: "Indiana", 15: "Iowa", 16: "Kansas", 17: "Kentucky", 18: "Louisiana", 19: "Maine", 20: "Maryland",
        21: "Massachusetts", 22: "Michigan", 23: "Minnesota", 24: "Mississippi", 25: "Missouri", 26: "Montana", 27: "Nebraska", 28: "Nevada", 29: "New Hampshire",
        30: "New Jersey", 31: "New Mexico", 32: "New York", 33: "North Carolina", 34: "North Dakota", 35: "Ohio", 36: "Oklahoma", 37: "Oregon", 38: "Pennsylvania",
        39: "Rhode Island", 40: "South Carolina", 41: "South Dakota", 42: "Tennessee", 43: "Texas", 44: "Utah", 45: "Vermont", 46: "Virginia", 47: "Washington",
        48: "West Virginia", 49: "Wisconsin", 50: "Wyoming"
    },
    "star_sign": {1: "Aries", 2: "Taurus", 3: "Gemini", 4: "Cancer", 5: "Leo", 6: "Virgo", 7: "Libra", 8: "Scorpio", 9: "Sagittarius", 10: "Capricorn", 11: "Aquarius", 12: "Pisces"},
    "drinking": {1: "Socially", 2: "Frequently", 3: "Rarely", 4: "Never", 5: "Sober"},
    "politics": {1: "Liberal", 2: "Conservative", 3: "Moderate", 4: "Apolitical"},
    "smoking": {1: "Never", 2: "Socially", 3: "Regularly"},
    "cannabis": {1: "Never", 2: "Socially", 3: "Frequently", 4: "Rarely"},
    "looking_for": {1: "Relationship", 2: "Something casual", 3: "Don't know yet", 4: "Marriage"},
}

IGNORE_FIELDS = {"user_id", "name", "about_me", "education", "occupation_raw"}
MIN_SLICE_PCT = 2.0
DISPLAY_NAME_MAP = {"education_level": "Education", "looking_for": "Looking for", "star_sign": "Star sign"}
ZODIAC_ORDER = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]

STATE_POPULATION_ORDER = [
    "California", "Texas", "Florida", "New York", "Pennsylvania", "New Jersey", "Washington",
    "Louisiana", "Oklahoma", "Connecticut", "Georgia", "Illinois", "Ohio", "Michigan",
    "North Carolina", "Massachusetts", "Virginia", "Arizona", "Colorado", "Maryland",
    "Minnesota", "Missouri", "Indiana", "Tennessee", "Wisconsin", "South Carolina",
    "Louisiana", "Kentucky", "Oregon", "Alabama", "New Mexico", "Nevada", "Utah",
    "Arkansas", "Kansas", "Mississippi", "Iowa", "Idaho", "Nebraska", "West Virginia",
    "New Hampshire", "Maine", "Montana", "Rhode Island", "Delaware", "South Dakota",
    "North Dakota", "Alaska", "Vermont", "Wyoming", "Hawaii"
]

def get_profiles_cached():
    global _profiles_cache
    if _profiles_cache is not None:
        print("Serving profiles from cache")
        return _profiles_cache
    client = get_db_client()
    db_name = os.environ.get("MONGODB_DB", "Profiles")
    collection_name = os.environ.get("MONGODB_COLLECTION", "Profiles")
    db = client[db_name]
    collection = db[collection_name]
    print("Fetching profiles from MongoDB")
    _profiles_cache = list(collection.find({}, {'_id': False}))
    print(f"Cached {len(_profiles_cache)} profiles")
    return _profiles_cache


def map_value(attr, value):
    value_map = VALUE_MAPS.get(attr)
    if not value_map:
        return value
    if value in value_map:
        return value_map[value]
    try:
        ivalue = int(value)
        if ivalue in value_map:
            return value_map[ivalue]
    except Exception:
        pass
    return value


def decode_profiles_cached():
    global _decoded_profiles_cache
    if _decoded_profiles_cache is not None:
        return _decoded_profiles_cache

    decoded_profiles = []
    for profile in get_profiles_cached():
        decoded = {}
        for key, raw_value in profile.items():
            attr = ATTRIBUTE_MAP.get(str(key), str(key))
            decoded[attr] = map_value(attr, raw_value)
        decoded_profiles.append(decoded)

    _decoded_profiles_cache = decoded_profiles
    return _decoded_profiles_cache


def bucket_age(age_value):
    try:
        n = int(str(age_value).strip())
    except Exception:
        return None

    if n < 21:
        return "<21"
    start = 21 + ((n - 21) // 5) * 5
    end = start + 4
    return f"{start}-{end}"


def parse_age_bucket_start(label):
    if label.startswith("<"):
        return float("-inf")
    if label.startswith(">"):
        return float("inf")
    m = re.match(r"^(\d+)-", label)
    return int(m.group(1)) if m else float("inf")


def parse_height_to_inches(value):
    v = str(value).lower()

    # Support plain numeric forms:
    # 1-49 => encoded values where 1 maps to 3'0", 49 maps to 7'0"
    # 36-96 => already inches
    # 120-260 => centimeters
    plain_num = re.match(r"^\s*\d+(?:\.\d+)?\s*$", v)
    if plain_num:
        n = float(v.strip())
        if 1 <= n <= 49:
            return n + 35
        if 36 <= n <= 96:
            return n
        if 120 <= n <= 260:
            return n / 2.54

    feet_inches = re.search(r"(\d+)\s*'\s*(\d+)?", v)
    if feet_inches:
        feet = int(feet_inches.group(1))
        inches = int(feet_inches.group(2) or 0)
        return feet * 12 + inches

    ft = re.search(r"(\d+)\s*ft", v)
    inch = re.search(r"(\d+)\s*in", v)
    if ft:
        feet = int(ft.group(1))
        inches = int(inch.group(1)) if inch else 0
        return feet * 12 + inches

    cm = re.search(r"(\d+)\s*cm", v)
    if cm:
        return int(cm.group(1)) / 2.54

    return None


def format_inches(n):
    inches = round(n)
    ft = inches // 12
    inch = inches % 12
    return f"{ft}'{inch}\""


def bucket_height(height_value):
    inches = parse_height_to_inches(height_value)
    if inches is None:
        return None
    if inches >= 76:
        return ">6'3"
    start = int(inches // 4) * 4
    end = start + 3
    return f"{format_inches(start)}-{format_inches(end)}"


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
    is_age = attr == "age"
    is_height = attr == "height"
    counts = {}
    answered_count = 0

    for row in rows:
        value = row.get(attr)
        if value is None:
            continue

        if attr == "gender":
            raw = str(value).strip()
            value = raw if raw else "Non-binary/Gender Nonconforming"
        else:
            value = str(value)
            if not value.strip():
                continue

        if is_age:
            b = bucket_age(value)
            if b is None:
                continue
            value = b

        if is_height:
            b = bucket_height(value)
            if b is None:
                continue
            value = b

        counts[value] = counts.get(value, 0) + 1
        answered_count += 1

    return counts, answered_count


def sort_entries_for_attr(attr, entries):
    if attr == "age":
        entries.sort(key=lambda x: parse_age_bucket_start(x[0]))
    elif attr == "height":
        entries.sort(key=lambda x: parse_height_bucket_start(x[0]))
    elif attr == "star_sign":
        entries.sort(key=lambda x: ZODIAC_ORDER.index(x[0]) if x[0] in ZODIAC_ORDER else 999)
    elif attr == "location":
        entries.sort(key=lambda x: STATE_POPULATION_ORDER.index(x[0]) if x[0] in STATE_POPULATION_ORDER else 999)
    elif attr == "cannabis":
        order = ["Never", "Socially", "Frequently"]
        entries.sort(key=lambda x: order.index(x[0]) if x[0] in order else 999)
    elif attr == "drinking":
        order = ["Never", "Rarely", "Socially", "Frequently", "Sober"]
        entries.sort(key=lambda x: order.index(x[0]) if x[0] in order else 999)
    elif attr == "smoking":
        order = ["Never", "Socially", "Regularly"]
        entries.sort(key=lambda x: order.index(x[0]) if x[0] in order else 999)
    elif attr == "exercise":
        order = ["Almost never", "Sometimes", "Often", "Every day", "Active"]
        entries.sort(key=lambda x: order.index(x[0]) if x[0] in order else 999)
    elif attr == "education_level":
        order = ["High school", "Trade/tech school", "In college", "In grad school", "Undergraduate degree", "Graduate degree"]
        entries.sort(key=lambda x: order.index(x[0]) if x[0] in order else 999)
    elif attr == "politics":
        order = ["Liberal", "Moderate", "Conservative", "Apolitical"]
        entries.sort(key=lambda x: order.index(x[0]) if x[0] in order else 999)
    elif attr == "kids":
        order = ["Don't want", "Not sure yet", "Open to kids", "Has kids", "Want someday"]
        entries.sort(key=lambda x: order.index(x[0]) if x[0] in order else 999)
    elif attr == "looking_for":
        order = ["Relationship", "Marriage", "Something casual", "Don't know yet"]
        entries.sort(key=lambda x: order.index(x[0]) if x[0] in order else 999)
    elif attr == "religion":
        entries.sort(key=lambda x: x[1], reverse=True)
    elif attr == "occupation":
        entries.sort(key=lambda x: x[0])
    else:
        entries.sort(key=lambda x: x[1], reverse=True)


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

        labels = []
        if attr in {"star_sign", "looking_for", "kids"}:
            labels = [l for l, _ in entries]
        elif attr == "religion":
            other_count = 0
            for label, count in entries:
                pct = (count / answered_count) * 100
                is_explicit_other = str(label).strip().lower() == "other"
                if is_explicit_other or pct < MIN_SLICE_PCT:
                    other_count += count
                else:
                    labels.append(label)
            if other_count > 0:
                labels.append("Other")
        else:
            other_count = 0
            for label, count in entries:
                pct = (count / answered_count) * 100
                if pct < MIN_SLICE_PCT:
                    other_count += count
                else:
                    labels.append(label)
            if other_count > 0:
                labels.append("Other")

        schema[attr] = labels

    return schema


def get_chart_label_schema_cached():
    global _chart_label_schema_cache
    if _chart_label_schema_cache is not None:
        return _chart_label_schema_cache

    all_rows = decode_profiles_cached()
    _chart_label_schema_cache = build_chart_label_schema(all_rows, FIXED_HEADERS)
    return _chart_label_schema_cache


def build_attribute_charts(rows, headers, label_schema=None):
    charts = []

    for attr in headers:
        if not attr or attr in IGNORE_FIELDS:
            continue

        is_age = attr == "age"
        is_height = attr == "height"

        counts, answered_count = count_attribute_values(rows, attr)

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
        elif attr in {"star_sign", "looking_for", "kids"}:
            labels = [l for l, _ in entries]
            values = [c for _, c in entries]
        elif attr == "religion":
            other_count = 0
            for label, count in entries:
                pct = (count / answered_count) * 100
                is_explicit_other = str(label).strip().lower() == "other"
                if is_explicit_other or pct < MIN_SLICE_PCT:
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
                if pct < MIN_SLICE_PCT:
                    other_count += count
                else:
                    labels.append(label)
                    values.append(count)
            if other_count > 0:
                labels.append("Other")
                values.append(other_count)

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

    return bucket_age(age_value) == label


def parse_feet_inches(text):
    m = re.match(r"^(\d+)\s*'\s*(\d+)\"$", str(text).strip())
    if not m:
        return None
    return int(m.group(1)) * 12 + int(m.group(2))


def matches_height_filter(height_value, selected_label):
    inches = parse_height_to_inches(height_value)
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


def apply_filters(rows, filters):
    if not filters:
        return rows

    out = []
    for row in rows:
        keep = True
        for attr, raw_val in filters.items():
            values = raw_val if isinstance(raw_val, list) else [raw_val]
            values = [v for v in values if v is not None and str(v).strip() != ""]
            if not values:
                continue

            if attr == "age":
                if not any(matches_age_filter(row.get(attr), val) for val in values):
                    keep = False
                    break
                continue

            if attr == "height":
                if not any(matches_height_filter(row.get(attr), val) for val in values):
                    keep = False
                    break
                continue

            if not any(row.get(attr) == val for val in values):
                keep = False
                break

        if keep:
            out.append(row)
    return out


def compute_delusion_pct(all_rows, filtered_rows, filters):
    if not filters:
        return 0.0

    min_answered = None
    min_attr = None
    for attr in filters.keys():
        answered = 0
        for row in all_rows:
            value = row.get(attr)
            if value is not None and str(value).strip() != "":
                answered += 1
        if min_answered is None or answered < min_answered:
            min_answered = answered
            min_attr = attr

    if not min_answered or min_answered <= 0:
        return 0.0

    filtered_answered = 0
    for row in filtered_rows:
        value = row.get(min_attr)
        if value is not None and str(value).strip() != "":
            filtered_answered += 1

    raw_delusion = 100 * (1 - (filtered_answered / min_answered))
    if len(filtered_rows) == 0:
        return 100.0
    return round(min(99.9, max(0.0, raw_delusion)), 1)


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
    filters = {}
    for key, raw in incoming_filters.items():
        attr = str(key)
        if isinstance(raw, list):
            vals = [str(v).strip() for v in raw if v is not None and str(v).strip() != ""]
            if vals:
                filters[attr] = vals
            continue
        if raw is not None and str(raw).strip() != "":
            filters[attr] = str(raw).strip()

    all_rows = decode_profiles_cached()
    filtered_rows = apply_filters(all_rows, filters)
    label_schema = get_chart_label_schema_cached()
    charts = build_attribute_charts(filtered_rows, FIXED_HEADERS, label_schema=label_schema)

    return jsonify({
        "charts": charts,
        "filteredCount": len(filtered_rows),
        "totalCount": len(all_rows),
        "delusionPct": compute_delusion_pct(all_rows, filtered_rows, filters),
    })

@app.route('/profiles')
def get_profiles():
    docs = get_profiles_cached()
    return jsonify(docs)

if __name__ == '__main__':
    app.run(debug=True)