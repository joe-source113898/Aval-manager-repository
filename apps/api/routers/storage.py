from __future__ import annotations

from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from apps.api.core.auth import require_admin
from apps.api.services.storage import (
    DEFAULT_BUCKET,
    build_proxy_url,
    download_storage_object,
    normalize_storage_path,
    verify_storage_token,
)

router = APIRouter(prefix="/storage", tags=["storage"])


class StorageSignRequest(BaseModel):
    path: str = Field(..., description="Ruta relativa dentro del bucket.")
    bucket: str = Field(default=DEFAULT_BUCKET, description="Nombre del bucket de Supabase.")
    expires_in: int | None = Field(
        default=3600,
        ge=60,
        le=60 * 60 * 24,
        description="Duración del enlace en segundos (entre 60 y 86400).",
    )


class StorageSignResponse(BaseModel):
    url: str
    token: str
    bucket: str
    path: str
    expires_at: str


@router.post("/sign", response_model=StorageSignResponse)
async def sign_storage_object(payload: StorageSignRequest, _: dict = Depends(require_admin)) -> StorageSignResponse:
    try:
        url, bucket, expires_at, token = build_proxy_url(payload.bucket, payload.path, payload.expires_in)
        normalized_path = normalize_storage_path(payload.path)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return StorageSignResponse(
        url=url,
        token=token,
        bucket=bucket,
        path=normalized_path,
        expires_at=expires_at,
    )


@router.get("/proxy")
async def proxy_storage_object(
    token: str = Query(..., description="Token emitido por el endpoint /storage/sign"),
    download: bool = Query(default=False, description="Forzar la descarga como attachment."),
):
    bucket, path = verify_storage_token(token)
    file_bytes, filename, mime_type = download_storage_object(bucket, path)
    disposition = "attachment" if download else "inline"
    headers = {
        "Content-Disposition": f'{disposition}; filename="{filename}"',
        "Cache-Control": "private, max-age=60",
    }
    return StreamingResponse(BytesIO(file_bytes), media_type=mime_type, headers=headers)
