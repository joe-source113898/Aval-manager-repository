from __future__ import annotations

from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.encoders import jsonable_encoder

from apps.api.core.auth import require_admin
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import PagoComision, PagoComisionCreate, PagoComisionUpdate

router = APIRouter(prefix="/pagos-comisiones", tags=["pagos-comisiones"])


@router.get("", response_model=List[PagoComision])
async def list_pagos_comisiones(
    beneficiario_id: UUID | None = Query(default=None),
    beneficiario_tipo: str | None = Query(default=None),
    firma_id: UUID | None = Query(default=None),
    estado: str | None = Query(default=None),
    corte_id: UUID | None = Query(default=None),
    sin_corte: bool | None = Query(default=None),
    fecha_inicio: datetime | None = Query(default=None),
    fecha_fin: datetime | None = Query(default=None),
    _: dict = Depends(require_admin),
) -> List[PagoComision]:
    client = get_client()
    query = client.table("pagos_comisiones").select("*")
    if beneficiario_id:
        query = query.eq("beneficiario_id", str(beneficiario_id))
    if beneficiario_tipo:
        query = query.eq("beneficiario_tipo", beneficiario_tipo)
    if firma_id:
        query = query.eq("firma_id", str(firma_id))
    if estado:
        query = query.eq("estado", estado)
    if corte_id:
        query = query.eq("corte_id", str(corte_id))
    if sin_corte:
        query = query.is_("corte_id", "null")
    if fecha_inicio:
        query = query.gte("fecha_pago", fecha_inicio.isoformat())
    if fecha_fin:
        query = query.lte("fecha_pago", fecha_fin.isoformat())
    response = query.order("fecha_pago", desc=True).execute()
    return [PagoComision(**row) for row in handle_response(response)]


@router.post("", response_model=PagoComision, status_code=status.HTTP_201_CREATED)
async def create_pago_comision(payload: PagoComisionCreate, _: dict = Depends(require_admin)) -> PagoComision:
    client = get_client()
    data_payload = jsonable_encoder(payload)
    response = client.table("pagos_comisiones").insert(data_payload).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=500, detail="No se pudo registrar el pago de comisión")
    return PagoComision(**data[0])


@router.put("/{pago_id}", response_model=PagoComision)
async def update_pago_comision(pago_id: UUID, payload: PagoComisionUpdate, _: dict = Depends(require_admin)) -> PagoComision:
    client = get_client()
    data_payload = {k: v for k, v in jsonable_encoder(payload).items() if v is not None}
    response = client.table("pagos_comisiones").update(data_payload).eq("id", str(pago_id)).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")
    return PagoComision(**data[0])


@router.delete("/{pago_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pago_comision(pago_id: UUID, _: dict = Depends(require_admin)) -> Response:
    client = get_client()
    client.table("pagos_comisiones").delete().eq("id", str(pago_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
