from pydantic import BaseModel, Field, validator
from datetime import datetime
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
    student_id: str  # clave del hilo -- 1 hilo por alumno (alumno + su profesor/admin)
    sender_id: str
    text: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class MessageResponse(BaseModel):
    id: str
    student_id: str
    sender_id: str
    text: str
    created_at: datetime
