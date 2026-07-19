from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

class NoteUpsert(BaseModel):
    """Cuerpo de PUT /api/notes/{content_unit_key}/{case_index} -- guardar con text vacío borra
    la nota (ver NoteRepository.upsert)."""
    text: str
    label: Optional[str] = None

class NoteInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    content_unit_key: str
    case_index: int
    text: str
    label: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class NoteResponse(NoteInDB):
    pass
