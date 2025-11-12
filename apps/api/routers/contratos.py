from __future__ import annotations

from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from apps.api.core.auth import require_admin
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import Contrato, ContratoCreate, ContratoUpdate

router = APIRouter(prefix="/contratos", tags=["contratos"])


@router.get("", response_model=List[Contrato])
async def list_contratos(_: dict = Depends(require_admin)) -> List[Contrato]:
    client = get_client()
    response = client.table("contratos").select("*").order("created_at", desc=True).execute()
    return [Contrato(**row) for row in handle_response(response)]


@router.post("", response_model=Contrato, status_code=status.HTTP_201_CREATED)
async def create_contrato(payload: ContratoCreate, _: dict = Depends(require_admin)) -> Contrato:
    client = get_client()
    payload_dict = payload.dict()
    response = client.table("contratos").insert(payload_dict).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=500, detail="No se pudo crear el contrato")
    return Contrato(**data[0])


@router.get("/{contrato_id}", response_model=Contrato)
async def get_contrato(contrato_id: UUID, _: dict = Depends(require_admin)) -> Contrato:
    client = get_client()
    response = client.table("contratos").select("*").eq("id", str(contrato_id)).single().execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contrato no encontrado")
    return Contrato(**data)


@router.put("/{contrato_id}", response_model=Contrato)
async def update_contrato(contrato_id: UUID, payload: ContratoUpdate, _: dict = Depends(require_admin)) -> Contrato:
    client = get_client()
    data_payload = {k: v for k, v in payload.dict().items() if v is not None}
    data_payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    response = client.table("contratos").update(data_payload).eq("id", str(contrato_id)).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contrato no encontrado")
    return Contrato(**data[0])


@router.delete("/{contrato_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contrato(contrato_id: UUID, _: dict = Depends(require_admin)) -> Response:
    client = get_client()
    client.table("contratos").delete().eq("id", str(contrato_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
