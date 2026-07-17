from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from datetime import datetime
import uuid

# Whitelist explícito de campos + status fijo a 'pending' en la creación: en ADOC esto lo
# garantizaba una regla declarativa de Firestore (firestore.rules:36-39); FastAPI no tiene motor
# de reglas, así que se reimplementa aquí, en el propio modelo Pydantic de entrada.
class AccessRequestCreate(BaseModel):
    email: EmailStr
    nombre: str
    nacimiento: Optional[str] = None
    telefono: Optional[str] = None
    tiempo_prep: Optional[str] = None
    con_quien: Optional[str] = None
    puntos_debiles: Optional[str] = None
    mensaje: Optional[str] = None

    @validator('email')
    def email_len(cls, v):
        if len(v) > 200:
            raise ValueError('Email demasiado largo')
        return v

    @validator('nombre', 'nacimiento', 'telefono', 'tiempo_prep', 'con_quien', 'puntos_debiles', 'mensaje')
    def field_len(cls, v):
        if v is not None and len(v) > 3000:
            raise ValueError('Campo demasiado largo')
        return v

class AccessRequestInDB(AccessRequestCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "pending"  # pending -> converted | dismissed
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AccessRequestResponse(AccessRequestInDB):
    pass

class AccessRequestStatusUpdate(BaseModel):
    status: str  # 'converted' | 'dismissed'

    @validator('status')
    def valid_status(cls, v):
        if v not in ("converted", "dismissed", "pending"):
            raise ValueError('Estado no válido')
        return v
