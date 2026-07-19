from pydantic import BaseModel, Field
from typing import Dict, Optional
from datetime import datetime, date

class ContentScore(BaseModel):
    correct: int = 0
    total: int = 0
    pct: float = 0.0
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Estado de repetición espaciada (SM-2 simplificado, ver ProgressService._sm2_update) para
    # esta unidad de contenido -- alimenta el calendario de estudio.
    ease_factor: float = 2.5
    repetitions: int = 0
    interval_days: int = 0
    next_review_date: Optional[str] = None  # fecha ISO "2026-07-20"

class Streak(BaseModel):
    count: int = 0
    last_active_date: Optional[date] = None

class ProgressInDB(BaseModel):
    user_id: str
    content_scores: Dict[str, ContentScore] = Field(default_factory=dict)
    streak: Streak = Field(default_factory=Streak)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ProgressResponse(BaseModel):
    user_id: str
    content_scores: Dict[str, ContentScore]
    streak: Streak
    updated_at: datetime
