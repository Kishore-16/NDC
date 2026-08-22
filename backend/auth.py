"""Authentication helpers for Nexora.

Secrets stay in .env.local. The module uses MongoDB when MONGODB_URI is set.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, Optional


def load_local_env(override: bool = False) -> None:
    """Load local development settings without exposing them to the frontend.

    ``override`` is used for database connections so edits to .env.local do
    not leave a long-running local API process using a stale MongoDB URI.
    """
    env_file = Path(__file__).resolve().parents[1] / ".env.local"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if override or key not in os.environ:
            os.environ[key] = value


load_local_env()
JWT_SECRET = os.getenv("JWT_SECRET", "")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_OAUTH_REDIRECT_URI", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _json_b64(value: Dict[str, Any]) -> str:
    return _b64(json.dumps(value, separators=(",", ":")).encode("utf-8"))


def _secret() -> bytes:
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET is not configured in .env.local")
    return JWT_SECRET.encode("utf-8")


def create_token(user: Dict[str, Any], expires_in: int = 60 * 60 * 24 * 7) -> str:
    header = _json_b64({"alg": "HS256", "typ": "JWT"})
    payload = _json_b64({"sub": str(user["_id"]), "email": user["email"], "name": user.get("name", ""), "exp": int(time.time()) + expires_in})
    signed = f"{header}.{payload}".encode("ascii")
    signature = _b64(hmac.new(_secret(), signed, hashlib.sha256).digest())
    return f"{header}.{payload}.{signature}"


def verify_token(token: str) -> Dict[str, Any]:
    try:
        header, payload, signature = token.split(".")
        signed = f"{header}.{payload}".encode("ascii")
        expected = _b64(hmac.new(_secret(), signed, hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Invalid signature")
        padded = payload + "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded))
        if data["exp"] < time.time():
            raise ValueError("Expired token")
        return data
    except (ValueError, KeyError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid session") from exc


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=16384, r=8, p=1)
    return f"{_b64(salt)}${_b64(digest)}"


def check_password(password: str, stored: str) -> bool:
    try:
        salt_encoded, hash_encoded = stored.split("$", 1)
        salt = base64.urlsafe_b64decode(salt_encoded + "=" * (-len(salt_encoded) % 4))
        actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=16384, r=8, p=1)
        return hmac.compare_digest(_b64(actual), hash_encoded)
    except (ValueError, TypeError):
        return False


def get_users_collection():
    # Refresh local settings here because MongoDB is the only configuration
    # needed on every request and it is commonly corrected while the API runs.
    load_local_env(override=True)
    uri = os.getenv("MONGODB_URI", "")
    database = os.getenv("MONGODB_DB_NAME", "nexora")
    if not uri:
        raise RuntimeError("MONGODB_URI is not configured in .env.local")
    if not (uri.startswith("mongodb://") or uri.startswith("mongodb+srv://")):
        raise RuntimeError(
            "MONGODB_URI must start with mongodb:// or mongodb+srv://. "
            "For Atlas, use mongodb+srv:// (with two forward slashes)."
        )
    if "<db_username>" in uri or "<db_password>" in uri:
        raise RuntimeError(
            "MONGODB_URI still contains <db_username> or <db_password>. "
            "Replace both placeholders with your MongoDB Atlas database user's credentials."
        )
    try:
        from pymongo import MongoClient
    except ImportError as exc:
        raise RuntimeError("pymongo is required. Install backend requirements before starting the API.") from exc
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    client.admin.command("ping")
    users = client[database].users
    users.create_index("email", unique=True)
    return users


def google_authorization_url() -> str:
    if not all([GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI]):
        raise RuntimeError("Google OAuth settings are incomplete in .env.local")
    state_payload = {"nonce": secrets.token_urlsafe(20), "exp": int(time.time()) + 600}
    state = _json_b64(state_payload)
    state_signature = _b64(hmac.new(_secret(), state.encode("ascii"), hashlib.sha256).digest())
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
        "state": f"{state}.{state_signature}",
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)


def exchange_google_code(code: str, state: str) -> Dict[str, Any]:
    try:
        signed_state, signature = state.rsplit(".", 1)
        expected = _b64(hmac.new(_secret(), signed_state.encode("ascii"), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Invalid OAuth state")
        padded = signed_state + "=" * (-len(signed_state) % 4)
        if json.loads(base64.urlsafe_b64decode(padded))["exp"] < time.time():
            raise ValueError("Expired OAuth state")
    except (ValueError, KeyError, json.JSONDecodeError) as exc:
        raise ValueError("OAuth session expired. Please try again.") from exc

    body = urllib.parse.urlencode({
        "code": code, "client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI, "grant_type": "authorization_code",
    }).encode("utf-8")
    request = urllib.request.Request("https://oauth2.googleapis.com/token", data=body, method="POST")
    with urllib.request.urlopen(request, timeout=10) as response:
        tokens = json.loads(response.read())
    user_request = urllib.request.Request("https://openidconnect.googleapis.com/v1/userinfo", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    with urllib.request.urlopen(user_request, timeout=10) as response:
        profile = json.loads(response.read())
    if not profile.get("email") or not profile.get("email_verified", False):
        raise ValueError("Google did not return a verified email address")
    return profile
