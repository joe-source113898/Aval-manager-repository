from __future__ import annotations

import mimetypes
import re
from datetime import datetime, timedelta, timezone
from io import BytesIO
from typing import Tuple

from fastapi import HTTPException, status
from jose import JWTError, jwt
from supabase import StorageException

from apps.api.core.config import get_settings
from apps.api.db.supabase_client import get_client

DEFAULT_BUCKET = "documentos-aval"
ALLOWED_BUCKETS = {DEFAULT_BUCKET}
MIN_EXPIRATION_SECONDS = 60
MAX_EXPIRATION_SECONDS = 60 * 60 * 24
TOKEN_ALGORITHM = "HS256"

settings = get_settings()


def normalize_storage_path(path: str | None) -> str:
    if not path:
        return ""
    cleaned = path.strip()
    if cleaned.startswith(("http://", "https://")):
        try:
            cleaned = cleaned.split("/storage/v1/object/", 1)[-1]
        except Exception:  # pragma: no cover
            cleaned = path
    cleaned = cleaned.lstrip("/")
    if cleaned.startswith("storage/v1/object/"):
        cleaned = cleaned.split("storage/v1/object/", 1)[-1].lstrip("/")
    if cleaned.startswith("public/"):
        cleaned = cleaned.split("public/", 1)[-1].lstrip("/")
    if cleaned.startswith(f"{DEFAULT_BUCKET}/"):
        cleaned = cleaned[len(DEFAULT_BUCKET) + 1 :]
    segments = cleaned.split("/")
    normalized_segments = []
    for segment in segments:
        if not segment or segment == ".":
            continue
        if segment == "..":
            raise ValueError("Ruta de almacenamiento inválida.")
        normalized_segments.append(segment)
    return "/".join(normalized_segments)


def _normalize_bucket(bucket: str | None) -> str:
    value = (bucket or DEFAULT_BUCKET).strip()
    if value not in ALLOWED_BUCKETS:
        raise ValueError("Bucket no permitido.")
    return value


def _clamp_expiration(seconds: int | None) -> int:
    if seconds is None:
        return 3600
    return max(MIN_EXPIRATION_SECONDS, min(MAX_EXPIRATION_SECONDS, seconds))


def create_storage_token(bucket: str | None, path: str | None, expires_in: int | None = None) -> tuple[str, str, str]:
    normalized_bucket = _normalize_bucket(bucket)
    normalized_path = normalize_storage_path(path)
    if not normalized_path:
        raise ValueError("Ruta de almacenamiento vacía.")

    ttl = _clamp_expiration(expires_in)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=ttl)
    payload = {
        "sub": "storage-proxy",
        "bucket": normalized_bucket,
        "path": normalized_path,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, settings.supabase_jwt_secret, algorithm=TOKEN_ALGORITHM)
    return token, normalized_bucket, expires_at.isoformat()


def build_proxy_url(bucket: str | None, path: str | None, expires_in: int | None = None) -> tuple[str, str, str, str]:
    token, normalized_bucket, expires_at = create_storage_token(bucket, path, expires_in)
    return build_proxy_url_from_token(token), normalized_bucket, expires_at, token


def build_proxy_url_from_token(token: str) -> str:
    base = settings.api_base_url.rstrip("/")
    return f"{base}/storage/proxy?token={token}"


def verify_storage_token(token: str) -> tuple[str, str]:
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=[TOKEN_ALGORITHM],
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token inválido o expirado.") from exc

    bucket = payload.get("bucket")
    path = payload.get("path")
    if not bucket or not path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token incompleto.")

    normalized_bucket = _normalize_bucket(bucket)
    normalized_path = normalize_storage_path(path)
    if not normalized_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ruta inválida.")

    return normalized_bucket, normalized_path


def _guess_mime_type(filename: str) -> str:
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or "application/octet-stream"


def _sanitize_filename(filename: str) -> str:
    base = filename or "archivo"
    base = base.split("/")[-1]
    base = re.sub(r"[^\w.\-]+", "_", base)
    return base or "archivo"


def download_storage_object(bucket: str, path: str) -> Tuple[bytes, str, str]:
    normalized_bucket = _normalize_bucket(bucket)
    normalized_path = normalize_storage_path(path)
    if not normalized_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado.")

    client = get_client()
    storage = client.storage.from_(normalized_bucket)
    try:
        data = storage.download(normalized_path)
    except StorageException as exc:  # pragma: no cover
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado.") from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo descargar el archivo.") from exc

    if isinstance(data, bytes):
        file_bytes = data
    elif isinstance(data, BytesIO):
        file_bytes = data.getvalue()
    elif hasattr(data, "data"):
        file_bytes = data.data  # type: ignore[attr-defined]
    else:
        file_bytes = bytes(data)

    filename = _sanitize_filename(normalized_path.split("/")[-1])
    mime_type = _guess_mime_type(filename)
    return file_bytes, filename, mime_type
