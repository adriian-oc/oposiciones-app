from pydantic import BaseModel, Field
from typing import Dict, Optional
from datetime import datetime, date

class ContentScore(BaseModel):
    correct: int = 0
    total: int = 0
    pct: float = 0.0
    updated_at: datetime = Field(default_factory=datetime.utcnow)

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
