from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class ThemeBase(BaseModel):
    code: str  # e.g., GENERAL_01, SPECIFIC_01
    name: str
    part: str  # GENERAL or SPECIFIC
    order: int

class ThemeCreate(ThemeBase):
    pass

class ThemeInDB(ThemeBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ThemeResponse(ThemeBase):
    id: str
    created_at: datetime