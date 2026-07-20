from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional
import uuid

class MessageCreate(BaseModel):
    text: str

    @validator('text')
    def validate_text(cls, v):
        v = v.strip()
        if not v:
            raise ValueError('El mensaje no puede estar vacío')
        if len(v) > 3000:
            raise ValueError('El mensaje no puede superar los 3000 caracteres')
        return v

class MessageInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    # Clave del hilo: pese al nombre, es el id de CUALQUIER usuario no-admin que "es dueño" del
    # hilo -- un alumno (hilo visible para el alumno, su profesor asignado y cualquier admin) o
    # un profesor (hilo privado con administración, visible para ese profesor y cualquier admin).
    # Se mantiene el nombre student_id por compatibilidad con los hilos de alumno ya existentes.
    student_id: str
    sender_id: str
    text: str = ""
    # Ruta relativa dentro de uploads/ (p.ej. "chat/<uuid>.pdf"), servida desde /uploads -- mismo
    # patrón que avatar_path/document file_path. Un mensaje con adjunto puede llevar texto vacío
    # (pie de foto opcional), ver ChatAttachmentService.
    attachment_path: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None  # "image" | "file"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class MessageResponse(BaseModel):
    id: str
    student_id: str
    sender_id: str
    text: str
    attachment_path: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None
    created_at: datetime

class MessageReadInDB(BaseModel):
    """Cuándo leyó CADA usuario (alumno, o cada profesor/admin que comparte el hilo) por
    última vez el hilo de un alumno -- una fila por (user_id, student_id), no por mensaje."""
    user_id: str
    student_id: str
    last_read_at: datetime = Field(default_factory=datetime.utcnow)
