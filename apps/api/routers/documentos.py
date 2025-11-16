from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from apps.api.core.auth import require_admin, require_admin_or_asesor
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import Documento, DocumentoCreate, DocumentoUpdate
from apps.api.services.documentos import fetch_documentos

router = APIRouter(prefix="/documentos", tags=["documentos"])


@router.get("", response_model=List[Documento])
async def list_documentos(
    contrato_id: Optional[UUID] = Query(default=None),
    aval_id: Optional[UUID] = Query(default=None),
    cliente_id: Optional[UUID] = Query(default=None),
    _: dict = Depends(require_admin_or_asesor),
) -> List[Documento]:
    client = get_client()
    data = fetch_documentos(client, contrato_id=contrato_id, aval_id=aval_id, cliente_id=cliente_id)
    return [Documento(**row) for row in data]


@router.get("/aval/{aval_id}", response_model=List[Documento])
async def list_documentos_por_aval(aval_id: UUID, _: dict = Depends(require_admin_or_asesor)) -> List[Documento]:
    client = get_client()
    data = fetch_documentos(client, aval_id=aval_id)
    return [Documento(**row) for row in data]


@router.post("", response_model=Documento, status_code=status.HTTP_201_CREATED)
async def create_documento(payload: DocumentoCreate, _: dict = Depends(require_admin)) -> Documento:
    client = get_client()
    response = client.table("documentos").insert(payload.dict()).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=500, detail="No se pudo crear el documento")
    return Documento(**data[0])


@router.put("/{documento_id}", response_model=Documento)
async def update_documento(documento_id: UUID, payload: DocumentoUpdate, _: dict = Depends(require_admin)) -> Documento:
    client = get_client()
    data_payload = {k: v for k, v in payload.dict().items() if v is not None}
    response = client.table("documentos").update(data_payload).eq("id", str(documento_id)).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado")
    return Documento(**data[0])


@router.delete("/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_documento(documento_id: UUID, _: dict = Depends(require_admin)) -> Response:
    client = get_client()
    client.table("documentos").delete().eq("id", str(documento_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
