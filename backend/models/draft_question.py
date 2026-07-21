from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid


class DraftQuestionBase(BaseModel):
    theme_id: str
    text: str
    choices: List[str]
    correct_answer: int  # Index of correct choice (0-based)
    explanation: Optional[str] = None
    source_label: Optional[str] = None  # p.ej. "Novedad julio 2026 (Ley 1/2026)"


class DraftQuestionCreate(DraftQuestionBase):
    pass


class DraftQuestionUpdate(BaseModel):
    text: Optional[str] = None
    choices: Optional[List[str]] = None
    correct_answer: Optional[int] = None
    explanation: Optional[str] = None


class DraftQuestionInDB(DraftQuestionBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "draft"  # "draft" | "published"
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class DraftQuestionResponse(DraftQuestionBase):
    id: str
    status: str
    created_by: Optional[str] = None
    created_at: datetime


class PublishDraftQuestionsRequest(BaseModel):
    question_ids: List[str]
    theme_id: str
    target: str  # "cuadernillo" | "supuesto"
    title: Optional[str] = None
    description: Optional[str] = None


class PublishDraftQuestionsResponse(BaseModel):
    practical_set_id: str
    target: str
    question_count: int
    created_new: bool  # True si se creó un practical_set nuevo, False si se añadió a uno existente
