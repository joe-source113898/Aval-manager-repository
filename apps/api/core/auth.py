from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from gotrue.errors import AuthApiError

from apps.api.db.supabase_client import get_client, handle_response


def _extract_role(user: dict) -> str | None:
    metadata_sources = [
        user.get("app_metadata", {}),
        user.get("user_metadata", {}),
    ]
    for source in metadata_sources:
        role = (source or {}).get("role") or (source or {}).get("rol")
        if role:
            return str(role).lower()
    return None


def _normalize_role(role: str | None) -> str | None:
    if not role:
        return None
    role = role.strip().lower()
    if role == "super_admin":
        return "admin"
    return role


def _is_admin_role(role: str | None) -> bool:
    return role in {"admin", "service_role"}


async def _resolve_user_role(user: dict) -> str | None:
    role = _normalize_role(_extract_role(user))
    if role:
        return role
    client = get_client()
    try:
        response = (
            client.table("usuarios")
            .select("rol")
            .eq("id", str(user.get("id")))
            .single()
            .execute()
        )
        data = handle_response(response)
        return _normalize_role((data or {}).get("rol"))
    except Exception:  # noqa: BLE001
        return None


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Falta token")
    token = auth_header.split()[1]
    client = get_client()
    try:
        response = client.auth.get_user(token)
    except AuthApiError as exc:  # pragma: no cover
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido") from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido") from exc

    user = getattr(response, "user", None)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    app_metadata = getattr(user, "app_metadata", {}) or {}
    user_metadata = getattr(user, "user_metadata", {}) or {}

    return {
        "id": getattr(user, "id", None),
        "email": getattr(user, "email", None),
        "app_metadata": app_metadata,
        "user_metadata": user_metadata,
    }


async def require_admin(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    role = await _resolve_user_role(user)
    if not _is_admin_role(role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso restringido")
    user["role"] = role
    return user


async def require_admin_or_asesor(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    role = await _resolve_user_role(user)
    if role not in {"admin", "service_role", "asesor"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso restringido")
    user["role"] = role
    return user
