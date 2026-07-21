import logging
from pathlib import Path
from typing import Optional

import boto3
from botocore.client import Config as BotoConfig

from config.settings import settings

logger = logging.getLogger(__name__)

# Disco local, solo como fallback de desarrollo sin cuenta de R2 -- en un despliegue real
# (Render free) NO es persistente: se borra en cada reinicio/sueño del servicio, ver el aviso
# histórico que tenía esto mismo en document_submission_service.py antes de esta migración.
LOCAL_UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"


class StorageService:
    """Almacenamiento de archivos (avatares, documentos de profesor, adjuntos de chat) en
    Cloudflare R2 (API compatible S3) -- persistente de verdad, a diferencia del disco local del
    backend. Sin credenciales de R2 configuradas, cae de vuelta a disco local (mismo
    comportamiento de antes) para poder seguir desarrollando sin cuenta de R2."""

    def __init__(self):
        self.enabled = bool(
            settings.r2_account_id and settings.r2_access_key_id and settings.r2_secret_access_key
        )
        if self.enabled:
            self.bucket = settings.r2_bucket_name
            self.public_base_url = settings.r2_public_url.rstrip("/")
            self._client = boto3.client(
                "s3",
                endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
                aws_access_key_id=settings.r2_access_key_id,
                aws_secret_access_key=settings.r2_secret_access_key,
                config=BotoConfig(signature_version="s3v4"),
                region_name="auto",
            )
        else:
            logger.info("R2 no configurado -- StorageService usa disco local (solo desarrollo)")

    def save(self, folder: str, filename: str, content: bytes, content_type: str) -> str:
        """Guarda el archivo y devuelve el valor a persistir en Mongo (avatar_path/file_path/
        attachment_path): una URL pública completa si hay R2, o la ruta relativa de siempre si
        se cayó al disco local -- el frontend (avatarUrl.js, Chat.js, documentService.js) ya
        distingue los dos casos por si empieza por 'http'."""
        key = f"{folder}/{filename}"
        if self.enabled:
            self._client.put_object(Bucket=self.bucket, Key=key, Body=content, ContentType=content_type)
            return f"{self.public_base_url}/{key}"
        local_dir = LOCAL_UPLOAD_DIR / folder
        local_dir.mkdir(parents=True, exist_ok=True)
        (local_dir / filename).write_bytes(content)
        return key

    def delete(self, stored_value: Optional[str]) -> None:
        """Best-effort: si falla (archivo ya no existe, credenciales caducadas...) no bloquea el
        flujo que lo llama, igual que el borrado del avatar anterior antes de esta migración."""
        if not stored_value:
            return
        try:
            if stored_value.startswith("http"):
                if not self.enabled:
                    return
                key = stored_value[len(self.public_base_url) + 1:]
                self._client.delete_object(Bucket=self.bucket, Key=key)
            else:
                (LOCAL_UPLOAD_DIR / stored_value).unlink(missing_ok=True)
        except Exception as e:
            logger.warning(f"No se pudo borrar el archivo anterior ({stored_value}): {e}")
