from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class DocumentSubmissionCreate(BaseModel):
    area_id: str
    theme_id: str

class DocumentSubmissionInDB(DocumentSubmissionCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    uploaded_by: str  # user id del profesor
    file_path: str  # ruta relativa dentro de uploads/documents -- ver storage note en el servicio
    original_filename: str
    status: str = "pending"  # pending -> approved | rejected
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DocumentSubmissionResponse(DocumentSubmissionInDB):
    pass

class DocumentSubmissionStatusUpdate(BaseModel):
    status: str  # 'approved' | 'rejected'
