from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from datetime import datetime
import uuid

# Whitelist explícito de campos + status fijo a 'pending' en la creación: solo se acepta lo que
# el modelo declara, así el endpoint público no puede usarse para escribir campos arbitrarios.
class AccessRequestCreate(BaseModel):
    tipo: str = "alumno"  # "alumno" | "profesor"
    email: EmailStr
    nombre: str
    telefono: Optional[str] = None
    mensaje: Optional[str] = None
    # Campos de alumno (formulario "Solicita acceso")
    nacimiento: Optional[str] = None
    tiempo_prep: Optional[str] = None
    con_quien: Optional[str] = None
    puntos_debiles: Optional[str] = None
    # Campos de profesor (formulario "Trabaja con nosotros")
    especialidad: Optional[str] = None
    experiencia: Optional[str] = None
    disponibilidad: Optional[str] = None

    @validator('tipo')
    def valid_tipo(cls, v):
        if v not in ("alumno", "profesor"):
            raise ValueError('Tipo no válido')
        return v

    @validator('email')
    def email_len(cls, v):
        if len(v) > 200:
            raise ValueError('Email demasiado largo')
        return v

    @validator(
        'nombre', 'nacimiento', 'telefono', 'tiempo_prep', 'con_quien', 'puntos_debiles',
        'especialidad', 'experiencia', 'disponibilidad', 'mensaje',
    )
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
