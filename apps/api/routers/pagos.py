from __future__ import annotations

from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from apps.api.core.auth import require_admin
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import Pago, PagoCreate, PagoUpdate

router = APIRouter(prefix="/pagos", tags=["pagos"])


@router.get("", response_model=List[Pago])
async def list_pagos(_: dict = Depends(require_admin)) -> List[Pago]:
    client = get_client()
    response = client.table("pagos").select("*").order("created_at", desc=True).execute()
    return [Pago(**row) for row in handle_response(response)]


@router.post("", response_model=Pago, status_code=status.HTTP_201_CREATED)
async def create_pago(payload: PagoCreate, _: dict = Depends(require_admin)) -> Pago:
    client = get_client()
    data_payload = payload.dict()
    if data_payload.get("fecha_pago") is None:
        data_payload["fecha_pago"] = datetime.now(timezone.utc).isoformat()
    response = client.table("pagos").insert(data_payload).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=500, detail="No se pudo registrar el pago")
    return Pago(**data[0])


@router.put("/{pago_id}", response_model=Pago)
async def update_pago(pago_id: UUID, payload: PagoUpdate, _: dict = Depends(require_admin)) -> Pago:
    client = get_client()
    data_payload = {k: v for k, v in payload.dict().items() if v is not None}
    response = client.table("pagos").update(data_payload).eq("id", str(pago_id)).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")
    return Pago(**data[0])


@router.delete("/{pago_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pago(pago_id: UUID, _: dict = Depends(require_admin)) -> Response:
    client = get_client()
    client.table("pagos").delete().eq("id", str(pago_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
