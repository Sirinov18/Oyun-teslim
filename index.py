from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import re

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

WEB_ROOT = os.path.dirname(__file__)


@app.route("/", methods=["GET"])
def home():
    # Serve the website from the same server as the API
    return send_from_directory(WEB_ROOT, "index.html")


@app.route("/<path:filename>", methods=["GET"])
def static_files(filename: str):
    # Serve local static files (style.css, script.js, images, etc.)
    return send_from_directory(WEB_ROOT, filename)


def _codes_json_path() -> str:
    return os.path.join(os.path.dirname(__file__), "codes.json")


def normalize_code(value: object) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", str(value)).upper().strip()


def load_valid_codes() -> set[str]:
    try:
        with open(_codes_json_path(), "r", encoding="utf-8") as f:
            payload = json.load(f)
        codes = payload.get("codes", [])
        if not isinstance(codes, list):
            return set()
        return {c for c in (normalize_code(x) for x in codes) if c}
    except Exception:
        return set()


def load_payload() -> dict:
    try:
        with open(_codes_json_path(), "r", encoding="utf-8") as f:
            payload = json.load(f)
        return payload if isinstance(payload, dict) else {"codes": [], "bindings": {}}
    except Exception:
        return {"codes": [], "bindings": {}}


def save_payload(payload: dict) -> bool:
    try:
        with open(_codes_json_path(), "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
            f.write("\n")
        return True
    except Exception:
        return False

@app.route('/api/validate', methods=['POST'])
def validate_code():
    data = request.get_json(silent=True) or {}
    code = normalize_code(data.get("code", ""))
    if not code:
        return jsonify({"status": "wrong"}), 200
    # Consider a code valid if it's either in the available codes list
    # or already present in the bindings mapping (bound codes remain valid for display).
    payload = load_payload()
    valid_codes = load_valid_codes()
    bindings = payload.get("bindings", {}) if isinstance(payload, dict) else {}
    if code in valid_codes:
        return jsonify({"status": "correct"}), 200
    if code in (normalize_code(k) for k in bindings.keys()):
        # Return the bound game so the client can display it immediately
        bound_game = bindings.get(code) or bindings.get(next(k for k in bindings.keys() if normalize_code(k) == code))
        return jsonify({"status": "correct", "game": bound_game}), 200
    return jsonify({"status": "wrong"}), 200


@app.route("/api/bind", methods=["POST"])
def bind_code_to_game():
    """
    Permanently binds a valid code to a game in codes.json.
    Request JSON: { "code": "DFETB12", "game": "Elden Ring" }
    """
    data = request.get_json(silent=True) or {}
    code = normalize_code(data.get("code", ""))
    game = str(data.get("game", "")).strip()

    if not code or not game:
        return jsonify({"ok": False, "error": "missing_code_or_game"}), 400

    payload = load_payload()
    codes = payload.get("codes", [])
    if not isinstance(codes, list):
        codes = []
    valid_codes = {c for c in (normalize_code(x) for x in codes) if c}
    if code not in valid_codes:
        return jsonify({"ok": False, "error": "invalid_code"}), 400

    bindings = payload.get("bindings", {})
    if not isinstance(bindings, dict):
        bindings = {}

    existing = bindings.get(code)
    if existing:
        # Already bound: do not allow change
        return jsonify({"ok": True, "code": code, "game": existing, "locked": True}), 200

    # Bind the code to the selected game and remove it from the available codes
    bindings[code] = game

    # Remove the used code from the codes list so it cannot be reused.
    new_codes = [c for c in codes if normalize_code(c) != code]

    payload["bindings"] = bindings
    payload["codes"] = new_codes
    if not save_payload(payload):
        return jsonify({"ok": False, "error": "save_failed"}), 500

    return jsonify({"ok": True, "code": code, "game": game, "locked": True}), 200


@app.route("/api/delete-binding", methods=["POST"])
def delete_binding():
    """
    Deletes a code-game binding and restores the code to the available codes list.
    Request JSON: { "code": "DFETB12" }
    """
    data = request.get_json(silent=True) or {}
    code = normalize_code(data.get("code", ""))

    if not code:
        return jsonify({"ok": False, "error": "missing_code"}), 400

    payload = load_payload()
    bindings = payload.get("bindings", {})
    if not isinstance(bindings, dict):
        bindings = {}

    # Check if binding exists
    if code not in bindings:
        return jsonify({"ok": False, "error": "binding_not_found"}), 404

    # Remove the binding
    del bindings[code]

    # Restore code to the available codes list
    codes = payload.get("codes", [])
    if not isinstance(codes, list):
        codes = []
    codes.append(code)

    payload["bindings"] = bindings
    payload["codes"] = codes
    if not save_payload(payload):
        return jsonify({"ok": False, "error": "save_failed"}), 500

    return jsonify({"ok": True, "code": code, "message": "Binding deleted successfully"}), 200


if __name__ == '__main__':
    app.run(debug=True, host='localhost', port=5000)
