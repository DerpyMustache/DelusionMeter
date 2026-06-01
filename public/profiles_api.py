from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
import os
from pathlib import Path

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

@app.route('/profiles')
def get_profiles():
    docs = get_profiles_cached()
    return jsonify(docs)

if __name__ == '__main__':
    app.run(debug=True)