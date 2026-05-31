from playwright.sync_api import sync_playwright
import csv
import os
import time

PROFILES_CSV = "profiles.csv"
PROMPTS_CSV = "prompts.csv"
SESSION_FILE = "session.json"

seen_user_ids = set()
profile_rows = []
profile_fieldnames = set()

# ---------- CSV utilities ----------

def load_existing_profiles():
    if not os.path.exists(PROFILES_CSV):
        return

    with open(PROFILES_CSV, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            seen_user_ids.add(row["user_id"])
            profile_rows.append(row)
            profile_fieldnames.update(row.keys())

    print(f"Loaded {len(seen_user_ids)} existing profiles")


def write_profiles_csv():
    with open(PROFILES_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=sorted(profile_fieldnames)
        )
        writer.writeheader()
        writer.writerows(profile_rows)
        f.flush()


def append_prompt(row):
    exists = os.path.exists(PROMPTS_CSV)

    with open(PROMPTS_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["user_id", "name", "question", "answer"]
        )
        if not exists:
            writer.writeheader()
        writer.writerow(row)
        f.flush()


# ---------- Extraction ----------

def extract_from_response(data):
    results = data["body"][0]["client_encounters"]["results"]

    updated = False

    for result in results:
        user = result["user"]
        user_id = user.get("user_id")

        if not user_id or user_id in seen_user_ids:
            continue

        seen_user_ids.add(user_id)

        row = {
            "user_id": user_id,
            "name": user.get("name"),
            "age": user.get("age"),
            "gender": user.get("gender")
        }

        for field in user.get("profile_fields", []):
            field_type = field.get("type")
            name = field.get("name")
            value = field.get("display_value")

            if field_type == 26:
                append_prompt({
                    "user_id": user_id,
                    "name": user.get("name"),
                    "question": name,
                    "answer": value
                })
            else:
                key = name.lower().replace(" ", "_")
                row[key] = value

        profile_fieldnames.update(row.keys())
        profile_rows.append(row)
        updated = True

    if updated:
        write_profiles_csv()
        print(f"Saved profiles: {len(seen_user_ids)}")


# ---------- Main automation ----------

load_existing_profiles()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)

    # 🔐 Session persistence
    if os.path.exists(SESSION_FILE):
        context = browser.new_context(storage_state=SESSION_FILE)
        print("Loaded saved session")
    else:
        context = browser.new_context()
        print("No session found — login required")

    page = context.new_page()
    page.goto("https://bumble.com")

    if not os.path.exists(SESSION_FILE):
        print("Please sign in manually...")
        page.wait_for_selector(
            '[data-qa-role="encounters-action-dislike"]',
            timeout=0
        )
        context.storage_state(path=SESSION_FILE)
        print("Session saved")

    def on_response(response):
        if "SERVER_GET_ENCOUNTERS" in response.url:
            extract_from_response(response.json())

    page.on("response", on_response)

    pass_button = '[data-qa-role="encounters-action-dislike"]'

    try:
        while True:
            page.click(pass_button)
            time.sleep(0.6)
    except KeyboardInterrupt:
        print("Stopped by user")

    browser.close()
