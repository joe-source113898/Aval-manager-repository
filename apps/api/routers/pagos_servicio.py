from __future__ import annotations

from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.encoders import jsonable_encoder

from apps.api.core.auth import require_admin
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import PagoServicio, PagoServicioCreate, PagoServicioUpdate

router = APIRouter(prefix="/pagos-servicio", tags=["pagos-servicio"])


@router.get("", response_model=List[PagoServicio])
async def list_pagos_servicio(
    firma_id: UUID | None = Query(default=None),
    corte_id: UUID | None = Query(default=None),
    sin_corte: bool | None = Query(default=None),
    fecha_inicio: datetime | None = Query(default=None),
    fecha_fin: datetime | None = Query(default=None),
    _: dict = Depends(require_admin),
) -> List[PagoServicio]:
    client = get_client()
    query = client.table("pagos_servicio").select("*")
    if firma_id:
        query = query.eq("firma_id", str(firma_id))
    if corte_id:
        query = query.eq("corte_id", str(corte_id))
    if sin_corte:
        query = query.is_("corte_id", "null")
    if fecha_inicio:
        query = query.gte("fecha_pago", fecha_inicio.isoformat())
    if fecha_fin:
        query = query.lte("fecha_pago", fecha_fin.isoformat())
    response = query.order("fecha_pago", desc=True).execute()
    return [PagoServicio(**row) for row in handle_response(response)]


@router.post("", response_model=PagoServicio, status_code=status.HTTP_201_CREATED)
async def create_pago_servicio(payload: PagoServicioCreate, _: dict = Depends(require_admin)) -> PagoServicio:
    client = get_client()
    data_payload = jsonable_encoder(payload)
    if (data_payload.get("monto_efectivo", 0) or 0) <= 0 and (data_payload.get("monto_transferencia", 0) or 0) <= 0:
        raise HTTPException(status_code=400, detail="Debe capturar al menos un monto en efectivo o transferencia.")
    if data_payload.get("monto_transferencia", 0) > 0 and not data_payload.get("comprobante_url"):
        raise HTTPException(status_code=400, detail="El comprobante es obligatorio cuando hay transferencia.")
    response = client.table("pagos_servicio").insert(data_payload).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=500, detail="No se pudo registrar el pago del servicio")
    return PagoServicio(**data[0])


@router.put("/{pago_id}", response_model=PagoServicio)
async def update_pago_servicio(pago_id: UUID, payload: PagoServicioUpdate, _: dict = Depends(require_admin)) -> PagoServicio:
    client = get_client()
    data_payload = {k: v for k, v in jsonable_encoder(payload).items() if v is not None}
    response = client.table("pagos_servicio").update(data_payload).eq("id", str(pago_id)).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago no encontrado")
    return PagoServicio(**data[0])


@router.delete("/{pago_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pago_servicio(pago_id: UUID, _: dict = Depends(require_admin)) -> Response:
    client = get_client()
    client.table("pagos_servicio").delete().eq("id", str(pago_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
