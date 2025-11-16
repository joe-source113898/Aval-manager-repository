from __future__ import annotations

import re
import time
import unicodedata
from datetime import datetime, timezone
from io import BytesIO
from typing import List
from uuid import UUID
from zipfile import BadZipFile, ZipFile

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from pypdf import PdfReader, PdfWriter
from supabase import StorageException

from apps.api.core.auth import require_admin, require_admin_or_asesor
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import Aval, AvalBuroCreditoUploadResponse, AvalCreate, AvalDisponibilidadInput, AvalUpdate

router = APIRouter(prefix="/avales", tags=["avales"])
STORAGE_BUCKET = "documentos-aval"


def _sanitize_filename(filename: str) -> str:
    base = filename or "buro-credito.pdf"
    base = base.split("/")[-1]
    base = unicodedata.normalize("NFD", base).encode("ascii", "ignore").decode("ascii")
    base = base.lower().strip()
    base = re.sub(r"[^a-z0-9._-]+", "-", base)
    base = re.sub(r"-{2,}", "-", base).strip("-")
    if not base:
        base = f"buro-credito-{int(time.time())}.pdf"
    if not base.endswith(".pdf"):
        base = f"{base}.pdf"
    return base


def _extract_pdf_bytes(upload_bytes: bytes, filename: str) -> tuple[bytes, str]:
    lower_name = (filename or "").lower()
    if lower_name.endswith(".zip"):
        try:
            with ZipFile(BytesIO(upload_bytes)) as archive:
                pdf_members = [info for info in archive.infolist() if info.filename.lower().endswith(".pdf")]
                if not pdf_members:
                    raise HTTPException(status_code=400, detail="El ZIP no contiene ningún archivo PDF.")
                member = pdf_members[0]
                if member.flag_bits & 0x1:
                    raise HTTPException(
                        status_code=400,
                        detail="El ZIP está protegido con contraseña. Descomprime el archivo antes de subirlo.",
                    )
                return archive.read(member), member.filename
        except BadZipFile as exc:
            raise HTTPException(status_code=400, detail="El archivo comprimido está dañado o no es válido.") from exc
    if lower_name.endswith(".pdf"):
        return upload_bytes, filename
    raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF o ZIP que contengan un PDF.")


def _unlock_pdf_if_needed(pdf_bytes: bytes, password: str | None) -> bytes:
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="El PDF está dañado o tiene un formato no válido.") from exc
    if not reader.is_encrypted:
        return pdf_bytes
    if not password:
        raise HTTPException(status_code=400, detail="El PDF está protegido. Ingresa la clave para desbloquearlo.")
    try:
        result = reader.decrypt(password)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="No se pudo desbloquear el PDF. Verifica la clave proporcionada.") from exc
    if result == 0:
        raise HTTPException(status_code=400, detail="La clave del PDF es incorrecta.")
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    if reader.metadata:
        writer.add_metadata({k: v for k, v in reader.metadata.items() if v is not None})
    output = BytesIO()
    writer.write(output)
    writer.close()
    return output.getvalue()


def _build_storage_path(aval_id: UUID, filename: str) -> str:
    timestamp = int(time.time() * 1000)
    return f"avales/{aval_id}/buro_credito/{timestamp}-{filename}"


@router.get("", response_model=List[Aval])
async def list_avales(_: dict = Depends(require_admin_or_asesor)) -> List[Aval]:
    client = get_client()
    response = client.table("avales").select("*").order("created_at", desc=True).execute()
    return [Aval(**row) for row in handle_response(response)]


def _sync_disponibilidades(client, aval_id: UUID, blocks: list[AvalDisponibilidadInput], replace_existing: bool) -> None:
    if replace_existing:
        client.table("disponibilidades_avales").delete().eq("aval_id", str(aval_id)).execute()
    if not blocks:
        return
    rows = []
    for block in blocks:
        start = block.fecha_inicio.isoformat() if isinstance(block.fecha_inicio, datetime) else block.fecha_inicio
        end = block.fecha_fin.isoformat() if isinstance(block.fecha_fin, datetime) else block.fecha_fin
        rows.append(
            {
                "aval_id": str(aval_id),
                "fecha_inicio": start,
                "fecha_fin": end,
                "recurrente": block.recurrente,
            }
        )
    client.table("disponibilidades_avales").insert(rows).execute()


@router.post("", response_model=Aval, status_code=status.HTTP_201_CREATED)
async def create_aval(payload: AvalCreate, _: dict = Depends(require_admin)) -> Aval:
    client = get_client()
    disponibilidades = payload.disponibilidades or []
    aval_payload = payload.dict(exclude={"disponibilidades"})
    response = client.table("avales").insert(aval_payload).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=500, detail="No se pudo crear el aval")
    aval = Aval(**data[0])
    if disponibilidades:
        _sync_disponibilidades(client, aval.id, disponibilidades, replace_existing=False)
    return aval


@router.get("/{aval_id}", response_model=Aval)
async def get_aval(aval_id: UUID, _: dict = Depends(require_admin)) -> Aval:
    client = get_client()
    response = client.table("avales").select("*").eq("id", str(aval_id)).single().execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aval no encontrado")
    return Aval(**data)


@router.put("/{aval_id}", response_model=Aval)
async def update_aval(aval_id: UUID, payload: AvalUpdate, _: dict = Depends(require_admin)) -> Aval:
    client = get_client()
    disponibilidades = payload.disponibilidades
    data_payload = {k: v for k, v in payload.dict(exclude={"disponibilidades"}).items() if v is not None}
    data_payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    response = client.table("avales").update(data_payload).eq("id", str(aval_id)).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aval no encontrado")
    aval = Aval(**data[0])
    if disponibilidades is not None:
        _sync_disponibilidades(client, aval.id, disponibilidades, replace_existing=True)
    return aval


@router.post("/{aval_id}/buro-credito", response_model=AvalBuroCreditoUploadResponse)
async def upload_buro_credito(
    aval_id: UUID,
    file: UploadFile = File(...),
    password: str = Form(default=""),
    _: dict = Depends(require_admin),
) -> AvalBuroCreditoUploadResponse:
    client = get_client()
    response = client.table("avales").select("buro_credito_url").eq("id", str(aval_id)).single().execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aval no encontrado")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo recibido está vacío.")

    pdf_bytes, inner_filename = _extract_pdf_bytes(file_bytes, file.filename or "")
    unlocked_bytes = _unlock_pdf_if_needed(pdf_bytes, password or None)
    sanitized_name = _sanitize_filename(inner_filename or file.filename or "")
    storage_path = _build_storage_path(aval_id, sanitized_name)

    bucket = client.storage.from_(STORAGE_BUCKET)
    previous_path = data.get("buro_credito_url")
    if previous_path:
        try:
            bucket.remove([previous_path])
        except Exception:
            # No es crítico si la eliminación falla; continuamos con el reemplazo
            pass

    try:
        bucket.upload(
            storage_path,
            BytesIO(unlocked_bytes),
            {
                "content-type": "application/pdf",
                "x-upsert": "true",
                "cache-control": "3600",
            },
        )
    except StorageException as exc:
        raise HTTPException(status_code=500, detail="No se pudo guardar el Buró de crédito.") from exc

    client.table("avales").update(
        {
            "buro_credito_url": storage_path,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", str(aval_id)).execute()

    return AvalBuroCreditoUploadResponse(buro_credito_url=storage_path)


@router.delete("/{aval_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_aval(aval_id: UUID, _: dict = Depends(require_admin)) -> Response:
    client = get_client()
    client.table("avales").delete().eq("id", str(aval_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
