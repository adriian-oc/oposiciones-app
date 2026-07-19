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
    # Sesiones de práctica sueltas por tema/caso (Supuestos, Cuadernillos) se modelan como un
    # "examen" más en vez de un stack de scoring/analytics aparte -- mode distingue de un examen
    # formal generado por ExamGenerator; content_unit_key apunta al practical_set de origen;
    # cases se denormaliza aquí (en vez de recalcularse) para que el frontend pinte los puntos
    # de navegación por caso sin tener que volver a pedir el practical_set.
    mode: str = "exam"  # "exam" | "practice"
    content_unit_key: Optional[str] = None
    cases: Optional[List[dict]] = None

class ExamResponse(BaseModel):
    id: str
    type: str
    name: str
    theme_ids: List[str]
    question_count: int
    created_by: str
    created_at: datetime
    mode: str = "exam"
    content_unit_key: Optional[str] = None
    cases: Optional[List[dict]] = None

# Attempts
class AnswerSubmit(BaseModel):
    question_id: str
    selected_answer: Optional[int] = None  # None = no answer

class AttemptStart(BaseModel):
    exam_id: str
    live_correction: bool = False

class AttemptInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    exam_id: str
    user_id: str
    answers: Dict[str, Optional[int]] = {}  # question_id -> selected_answer
    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None
    score: Optional[float] = None
    details: Optional[Dict[str, Any]] = None
    # Denormalizado del exam de origen para poder consultar attempts por content_unit_key
    # directamente (rollup de progreso, Fase 6) sin tener que unir contra `exams` cada vez.
    mode: str = "exam"
    content_unit_key: Optional[str] = None
    # Si está activo, submit_answer devuelve is_correct/correct_answer al momento de contestar
    # cada pregunta (en vez de solo al finalizar) -- decisión explícita del alumno al arrancar,
    # apagado por defecto para no reabrir el leak cerrado en ExamService._scrub_exam.
    live_correction: bool = False

class AttemptResponse(BaseModel):
    id: str
    exam_id: str
    user_id: str
    started_at: datetime
    finished_at: Optional[datetime]
    score: Optional[float]
    details: Optional[Dict[str, Any]]