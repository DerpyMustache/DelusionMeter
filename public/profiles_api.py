from flask import Flask, jsonify
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

cors_origins = "*" if "*" in allowed_origins else list(allowed_origins)
CORS(app, resources={r"/profiles": {"origins": cors_origins}})

def get_db_client():
    mongo_uri = os.environ.get("MONGODB_URI")
    if not mongo_uri:
        raise RuntimeError(
            "Missing MONGODB_URI environment variable. "
            "Set it in your shell or profiles-dashboard/.env."
        )
    print("Connecting to MongoDB")
    return MongoClient(mongo_uri)


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
    client = get_db_client()
    db_name = os.environ.get("MONGODB_DB", "Profiles")
    collection_name = os.environ.get("MONGODB_COLLECTION", "Profiles")
    db = client[db_name]
    collection = db[collection_name]
    docs = list(collection.find({}, {'_id': False}))
    return jsonify(docs)

if __name__ == '__main__':
    app.run(debug=True)