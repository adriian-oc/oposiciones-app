from pydantic import BaseModel, EmailStr, Field
from typing import Dict, List, Optional
from datetime import datetime
import uuid

class Profile(BaseModel):
    full_name: Optional[str] = None
    birth_date: Optional[str] = None
    prep_time: Optional[str] = None
    prep_with: Optional[str] = None
    weak_points: Optional[str] = None

class PaymentRecord(BaseModel):
    amount: Optional[float] = None
    date: Optional[str] = None
    note: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr
    display_name: str
    role: str = "student"  # admin, profesor, curator, student

class UserCreate(UserBase):
    """Alta de alumno/staff por un admin -- crea el roster en Mongo con una contraseña inicial
    inutilizable; el admin genera y comparte un enlace de restablecimiento para que la persona
    fije su propia contraseña (nunca se ve/gestiona una contraseña en claro)."""
    expires_at: Optional[datetime] = None
    allowed_content: Optional[List[str]] = None
    profile: Optional[Profile] = None

class UserInDB(UserBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    password_hash: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Restablecimiento de contraseña de un solo uso: se guarda solo el hash del token (igual que
    # una contraseña), nunca el token en claro. Ver services/auth_service.py.
    password_reset_token_hash: Optional[str] = None
    password_reset_expires: Optional[datetime] = None

    # Campos de roster de acceso/facturación del alumno
    expires_at: Optional[datetime] = None  # solo se aplica a role=student
    revoked: bool = False  # se comprueba ANTES de expires_at; bloquea cualquier rol, incluido staff
    allowed_content: Optional[List[str]] = None  # None = acceso completo
    assigned_profesor_id: Optional[str] = None
    last_reviewed_by: Dict[str, datetime] = Field(default_factory=dict)
    payment_type: Optional[str] = None
    payments_received: List[PaymentRecord] = Field(default_factory=list)
    profile: Optional[Profile] = None

class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime
    expires_at: Optional[datetime] = None
    revoked: bool = False
    allowed_content: Optional[List[str]] = None
    assigned_profesor_id: Optional[str] = None
    last_reviewed_by: Dict[str, datetime] = Field(default_factory=dict)
    payment_type: Optional[str] = None
    payments_received: List[PaymentRecord] = Field(default_factory=list)
    profile: Optional[Profile] = None
    has_novedades: Optional[bool] = None  # solo se rellena al listar para un admin/profesor concreto
    progress_summary: Optional[dict] = None  # solo se rellena al listar (AdminService.list_students)

class UserUpdate(BaseModel):
    """Campos que un admin puede parchear en el roster de un usuario existente."""
    display_name: Optional[str] = None
    revoked: Optional[bool] = None
    expires_at: Optional[datetime] = None
    allowed_content: Optional[List[str]] = None
    assigned_profesor_id: Optional[str] = None
    payment_type: Optional[str] = None
    payments_received: Optional[List[PaymentRecord]] = None
    profile: Optional[Profile] = None
    role: Optional[str] = None

class SelfProfileUpdate(BaseModel):
    """Autoservicio: lo que un usuario puede cambiar de sí mismo (nunca role/revoked/
    allowed_content/etc, que siguen siendo solo-admin vía UserUpdate)."""
    display_name: Optional[str] = None
    profile: Optional[Profile] = None