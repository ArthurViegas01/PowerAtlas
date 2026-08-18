"""Admin login for the data console's write tools.

``POST /api/v1/auth/login`` exchanges the admin password for a stateless,
expiring bearer token (see core/auth.py). Every dataset import/delete then
requires that token. With no ``PA_ADMIN_PASSWORD`` set, login returns 503 and
all writes stay refused, so a public deploy is read-only.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ....core.auth import create_token, password_matches
from ....core.config import get_settings
from ....models.auth import LoginRequest, LoginResponse

router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse, response_model_by_alias=True)
async def login(payload: LoginRequest) -> LoginResponse:
    settings = get_settings()
    if not settings.admin_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Administrador não configurado neste servidor (PA_ADMIN_PASSWORD).",
        )
    if not password_matches(settings, payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Senha incorreta.",
        )
    token, expires_at = create_token(settings)
    return LoginResponse(token=token, expires_at=expires_at)
