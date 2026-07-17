from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

class Choice(BaseModel):
    id: str
    text: str

class QuestionEditHistoryEntry(BaseModel):
    """Estado de la pregunta justo antes de una edición -- sustituye al overlay
    questionOverrides de ADOC ahora que cada pregunta tiene un id real y estable."""
    text: str
    choices: List[str]
    correct_answer: int
    edited_by: str
    edited_at: datetime = Field(default_factory=datetime.utcnow)

class QuestionBase(BaseModel):
    theme_id: str
    text: str
    choices: List[str]  # Simple list of choice texts
    correct_answer: int  # Index of correct choice (0-based)
    difficulty: str = "MEDIUM"  # EASY, MEDIUM, HARD
    tags: List[str] = []
    # Área de contenido (registro CONTENT_AREAS del frontend): "cuad", "ttesp", "ttgen"...
    # Un mismo theme_id (tema) puede tener pools de preguntas distintos por área.
    content_area: str = "cuad"

class QuestionCreate(QuestionBase):
    pass

class QuestionInDB(QuestionBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    edit_history: List[QuestionEditHistoryEntry] = Field(default_factory=list)

class QuestionResponse(QuestionBase):
    id: str
    created_by: Optional[str] = None
    created_at: datetime
    edit_history: List[QuestionEditHistoryEntry] = Field(default_factory=list)

# Upload models
class QuestionUploadItem(BaseModel):
    text: str
    choices: List[str]
    correct_answer: int
    difficulty: str = "MEDIUM"
    tags: List[str] = []

class BulkQuestionsUpload(BaseModel):
    theme_code: str
    questions: List[QuestionUploadItem]

class ListBulkQuestionsUpload(BaseModel):
    uploads: List[BulkQuestionsUpload]

class PracticalSetQuestion(BaseModel):
    position: int
    text: str
    choices: List[str]
    correct_answer: int

class PracticalSetUpload(BaseModel):
    title: str
    description: str
    questions: List[PracticalSetQuestion]  # Must be exactly 15