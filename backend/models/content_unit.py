from pydantic import BaseModel, Field
from typing import Optional
import uuid

class ContentUnitBase(BaseModel):
    area_id: str  # id de CONTENT_AREAS en el frontend: "tesp", "esq", "tgen", "ttesp", "ttgen"...
    theme_id: str
    kind: str  # "quiz" | "pdf" | "coming_soon"
    pdf_url: Optional[str] = None
    order: int = 0
    is_new: bool = False  # marca "NEW" en la web tras una actualización de contenido

class ContentUnitCreate(ContentUnitBase):
    pass

class ContentUnitInDB(ContentUnitBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

class ContentUnitResponse(ContentUnitBase):
    id: str
