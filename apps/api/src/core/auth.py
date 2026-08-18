"""Single-admin authentication for the write endpoints.

The API is read-only except for the data console's dataset import/delete, which
touch only the isolated `datasets` namespace. Those writes are gated on a valid
admin session: the operator logs in with ``PA_ADMIN_PASSWORD`` and receives a
stateless, HMAC-signed, expiring bearer token verified on each write.

Stateless by design (no session table): the token carries only its expiry, and
its signature is an HMAC over that expiry with a key derived from the password
(or ``PA_AUTH_SECRET``). Rotating the secret invalidates every outstanding
token. Single admin, so there is no user identity to carry.
"""

from __future__ import annotations

import base64
import hmac
import time
from hashlib import sha256

from fastapi import HTTPException, Request, status

from .config import Settings, get_settings


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def password_matches(settings: Settings, password: str) -> bool:
    """Constant-time password check. False when no admin is configured."""
    if not settings.admin_enabled:
        return False
    return hmac.compare_digest(password.encode(), settings.admin_password.encode())


def create_token(settings: Settings) -> tuple[str, int]:
    """Mint a session token; returns ``(token, expires_at_epoch_seconds)``."""
    expires_at = int(time.time()) + settings.admin_session_ttl_s
    payload = str(expires_at).encode()
    sig = hmac.new(settings.signing_key, payload, sha256).digest()
    return f"{_b64(payload)}.{_b64(sig)}", expires_at


def verify_token(settings: Settings, token: str) -> bool:
    """True when the token's signature is valid and it has not expired."""
    if not settings.admin_enabled or not token or token.count(".") != 1:
        return False
    payload_b64, sig_b64 = token.split(".", 1)
    try:
        payload = _unb64(payload_b64)
        sig = _unb64(sig_b64)
    except (ValueError, TypeError):
        return False
    expected = hmac.new(settings.signing_key, payload, sha256).digest()
    if not hmac.compare_digest(sig, expected):
        return False
    try:
        expires_at = int(payload.decode())
    except ValueError:
        return False
    return expires_at > int(time.time())


def _bearer(request: Request) -> str:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    return token.strip() if scheme.lower() == "bearer" else ""


def require_admin(request: Request) -> None:
    """FastAPI dependency: refuse the request unless a valid admin session.

    403 when no admin is configured (writes disabled on this server); 401 when
    a password is set but the caller has no valid, unexpired token.
    """
    settings = get_settings()
    if not settings.admin_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Escrita desabilitada: administrador não configurado (PA_ADMIN_PASSWORD).",
        )
    if not verify_token(settings, _bearer(request)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão de administrador ausente, inválida ou expirada. Faça login.",
            headers={"WWW-Authenticate": "Bearer"},
        )
