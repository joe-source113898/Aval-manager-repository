from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import List
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder
from decimal import Decimal

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from apps.api.core.auth import require_admin
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import PagoCorte, PagoCorteCreate
from apps.api.services.storage import build_proxy_url

STORAGE_BUCKET = "documentos-aval"

router = APIRouter(prefix="/pagos/cortes", tags=["pagos-cortes"])


@router.get("", response_model=List[PagoCorte])
async def list_pagos_cortes(_: dict = Depends(require_admin)) -> List[PagoCorte]:
    client = get_client()
    response = client.table("pagos_cortes").select("*").order("created_at", desc=True).execute()
    registros = handle_response(response) or []
    cortes: List[PagoCorte] = []
    for row in registros:
        pdf_path = row.get("pdf_path")
        pdf_url = None
        if pdf_path:
            try:
                pdf_url, *_ = build_proxy_url(STORAGE_BUCKET, pdf_path)
            except ValueError:
                pdf_url = None
        cortes.append(
            PagoCorte(
                **row,
                pdf_url=pdf_url,
            )
        )
    return cortes


@router.post("", response_model=PagoCorte, status_code=status.HTTP_201_CREATED)
async def create_pago_corte(payload: PagoCorteCreate, _: dict = Depends(require_admin)) -> PagoCorte:
    if payload.fecha_inicio > payload.fecha_fin:
        raise HTTPException(status_code=400, detail="La fecha inicio no puede ser mayor a la fecha fin.")

    client = get_client()

    servicios_query = client.table("pagos_servicio").select("*").is_("corte_id", "null")
    comisiones_query = client.table("pagos_comisiones").select("*").is_("corte_id", "null")
    fecha_inicio = datetime.combine(payload.fecha_inicio, datetime.min.time()).isoformat()
    fecha_fin = datetime.combine(payload.fecha_fin, datetime.max.time()).isoformat()
    servicios_query = servicios_query.gte("fecha_pago", fecha_inicio).lte("fecha_pago", fecha_fin)
    comisiones_query = comisiones_query.gte("fecha_pago", fecha_inicio).lte("fecha_pago", fecha_fin)

    servicios = handle_response(servicios_query.execute()) if payload.incluir_servicios else []
    comisiones = handle_response(comisiones_query.execute()) if payload.incluir_comisiones else []
    servicios = servicios or []
    comisiones = comisiones or []

    if not servicios and not comisiones:
        raise HTTPException(status_code=400, detail="No hay pagos dentro del rango seleccionado.")

    firma_ids = {row["firma_id"] for row in servicios + comisiones if row.get("firma_id")}
    firmas_map = {}
    if firma_ids:
        firmas_resp = (
            client.table("firmas")
            .select("id,cliente_nombre,asesor_nombre")
            .in_("id", list(firma_ids))
            .execute()
        )
        firmas_map = {item["id"]: item for item in handle_response(firmas_resp) or []}

    aval_ids = {row["beneficiario_id"] for row in comisiones if row.get("beneficiario_tipo") == "aval"}
    avales_map = {}
    if aval_ids:
        avales_resp = (
            client.table("avales").select("id,nombre_completo").in_("id", list(aval_ids)).execute()
        )
        avales_map = {item["id"]: item for item in handle_response(avales_resp) or []}

    asesor_ids = {row["beneficiario_id"] for row in comisiones if row.get("beneficiario_tipo") == "asesor"}
    asesores_map = {}
    if asesor_ids:
        asesores_resp = (
            client.table("asesores").select("id,nombre").in_("id", list(asesor_ids)).execute()
        )
        asesores_map = {item["id"]: item for item in handle_response(asesores_resp) or []}

    total_servicio = sum(
        (row.get("monto_efectivo") or 0) + (row.get("monto_transferencia") or 0) for row in servicios
    )
    total_comisiones = sum(row.get("monto") or 0 for row in comisiones)

    corte_id = uuid4()
    data_payload = {
        "id": str(corte_id),
        "fecha_inicio": payload.fecha_inicio.isoformat(),
        "fecha_fin": payload.fecha_fin.isoformat(),
        "total_servicio": total_servicio,
        "total_comisiones": total_comisiones,
    }
    insert_resp = client.table("pagos_cortes").insert(data_payload).execute()
    handle_response(insert_resp)

    pdf_path = _generate_and_upload_pdf(
        corte_id=str(corte_id),
        fecha_inicio=payload.fecha_inicio,
        fecha_fin=payload.fecha_fin,
        servicios=servicios,
        comisiones=comisiones,
        firmas_map=firmas_map,
        avales_map=avales_map,
        asesores_map=asesores_map,
        client=client,
    )

    client.table("pagos_cortes").update({"pdf_path": pdf_path}).eq("id", str(corte_id)).execute()

    if servicios:
        service_ids = [row["id"] for row in servicios]
        client.table("pagos_servicio").update({"corte_id": str(corte_id)}).in_("id", service_ids).execute()
    if comisiones:
        comision_ids = [row["id"] for row in comisiones]
        client.table("pagos_comisiones").update({"corte_id": str(corte_id)}).in_("id", comision_ids).execute()

    try:
        pdf_url, *_ = build_proxy_url(STORAGE_BUCKET, pdf_path)
    except ValueError:
        pdf_url = None

    return PagoCorte(
        id=corte_id,
        fecha_inicio=payload.fecha_inicio,
        fecha_fin=payload.fecha_fin,
        incluir_servicios=payload.incluir_servicios,
        incluir_comisiones=payload.incluir_comisiones,
        total_servicio=Decimal(str(total_servicio)),
        total_comisiones=Decimal(str(total_comisiones)),
        pdf_path=pdf_path,
        pdf_url=pdf_url,
        created_at=datetime.utcnow(),
    )


def _generate_and_upload_pdf(
    corte_id: str,
    fecha_inicio,
    fecha_fin,
    servicios,
    comisiones,
    firmas_map,
    avales_map,
    asesores_map,
    client,
) -> str:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    y = height - 40

    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(40, y, "Corte de pagos")
    y -= 16
    pdf.setFont("Helvetica", 10)
    pdf.drawString(40, y, f"Rango: {fecha_inicio.isoformat()} al {fecha_fin.isoformat()}")
    y -= 20

    if servicios:
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(40, y, "Pagos del servicio")
        y -= 16
        pdf.setFont("Helvetica", 9)
        for row in servicios:
            if y < 80:
                pdf.showPage()
                y = height - 40
                pdf.setFont("Helvetica-Bold", 12)
                pdf.drawString(40, y, "Pagos del servicio (cont.)")
                y -= 16
                pdf.setFont("Helvetica", 9)
            firma = firmas_map.get(row["firma_id"], {})
            cliente = firma.get("cliente_nombre", "—")
            total = (row.get("monto_efectivo") or 0) + (row.get("monto_transferencia") or 0)
            pdf.drawString(
                40,
                y,
                f"{cliente} | Efectivo: ${row.get('monto_efectivo', 0):,.2f} | Transferencia: ${row.get('monto_transferencia', 0):,.2f} | Total: ${total:,.2f}",
            )
            y -= 12
    else:
        pdf.drawString(40, y, "No se registraron pagos de servicio en este corte.")
        y -= 16

    if comisiones:
        if y < 120:
            pdf.showPage()
            y = height - 40
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(40, y, "Pagos de comisiones")
        y -= 16
        pdf.setFont("Helvetica", 9)
        for row in comisiones:
            if y < 80:
                pdf.showPage()
                y = height - 40
                pdf.setFont("Helvetica-Bold", 12)
                pdf.drawString(40, y, "Pagos de comisiones (cont.)")
                y -= 16
                pdf.setFont("Helvetica", 9)
            nombre = "—"
            if row.get("beneficiario_tipo") == "aval":
                nombre = avales_map.get(row["beneficiario_id"], {}).get("nombre_completo", "—")
            else:
                nombre = asesores_map.get(row["beneficiario_id"], {}).get("nombre", "—")
            firma = firmas_map.get(row["firma_id"], {})
            pdf.drawString(
                40,
                y,
                f"{row.get('beneficiario_tipo').capitalize()}: {nombre} | Firma: {firma.get('cliente_nombre', '—')} | Monto: ${row.get('monto', 0):,.2f}",
            )
            y -= 12
    else:
        pdf.drawString(40, y, "No se registraron comisiones en este corte.")
        y -= 16

    pdf.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()

    path = f"reportes/cortes/{corte_id}.pdf"
    storage = client.storage.from_(STORAGE_BUCKET)
    storage.upload(path, pdf_bytes, {"content-type": "application/pdf", "upsert": True})
    return path
