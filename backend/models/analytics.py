from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
import uuid

class FailureRecord(BaseModel):
    """Record of a failed question answer"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    question_id: str
    theme_id: str
    attempt_id: str
    failed_at: datetime = Field(default_factory=datetime.utcnow)
    selected_answer: Optional[int]
    correct_answer: int

class UserThemeStats(BaseModel):
    """Aggregated statistics for a user on a specific theme"""
    user_id: str
    theme_id: str
    total_questions_attempted: int = 0
    correct_answers: int = 0
    incorrect_answers: int = 0
    unanswered: int = 0
    accuracy_rate: float = 0.0
    last_updated: datetime = Field(default_factory=datetime.utcnow)

class FailureAnalytics(BaseModel):
    """Analytics response for user failures"""
    theme_id: str
    theme_name: str
    theme_code: str
    failure_count: int
    total_attempts: int
    accuracy_rate: float
    last_failed_at: Optional[datetime]

class StudyPlanItem(BaseModel):
    """Item in a personalized study plan"""
    theme_id: str
    theme_name: str
    theme_code: str
    priority: int  # 1 = highest priority
    failure_count: int
    accuracy_rate: float
    recommended_practice_count: int

class StudyPlanResponse(BaseModel):
    """Personalized study plan based on user's weaknesses"""
    user_id: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    weak_themes: List[StudyPlanItem]
    total_weak_areas: int

class OverallStats(BaseModel):
    """Overall statistics for a user"""
    user_id: str
    total_exams_completed: int = 0
    total_questions_answered: int = 0
    total_correct: int = 0
    total_incorrect: int = 0
    total_unanswered: int = 0
    overall_accuracy: float = 0.0
    average_score: float = 0.0
    best_score: float = 0.0
    weak_themes_count: int = 0
