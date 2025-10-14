from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

class ExamCreate(BaseModel):
    type: str  # THEORY_TOPIC, THEORY_MIXED, PRACTICAL, SIMULACRO
    name: str
    theme_ids: List[str]
    question_count: int = 10

class QuestionSnapshot(BaseModel):
    question_id: str
    text: str
    choices: List[str]
    correct_answer: int
    theme_id: str

class ExamInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str
    name: str
    theme_ids: List[str]
    questions: List[QuestionSnapshot]  # Snapshot of questions
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ExamResponse(BaseModel):
    id: str
    type: str
    name: str
    theme_ids: List[str]
    question_count: int
    created_by: str
    created_at: datetime

# Attempts
class AnswerSubmit(BaseModel):
    question_id: str
    selected_answer: Optional[int] = None  # None = no answer

class AttemptStart(BaseModel):
    exam_id: str

class AttemptInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    exam_id: str
    user_id: str
    answers: Dict[str, Optional[int]] = {}  # question_id -> selected_answer
    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None
    score: Optional[float] = None
    details: Optional[Dict[str, Any]] = None

class AttemptResponse(BaseModel):
    id: str
    exam_id: str
    user_id: str
    started_at: datetime
    finished_at: Optional[datetime]
    score: Optional[float]
    details: Optional[Dict[str, Any]]