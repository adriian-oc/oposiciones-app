from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime
import uuid

class PracticalSetQuestionCreate(BaseModel):
    position: int = Field(..., ge=1, le=15)
    text: str
    choices: List[str]
    correct_answer: int
    
    @validator('choices')
    def validate_choices(cls, v):
        if len(v) < 2:
            raise ValueError('At least 2 choices required')
        return v
    
    @validator('correct_answer')
    def validate_correct_answer(cls, v, values):
        if 'choices' in values and v >= len(values['choices']):
            raise ValueError('correct_answer index out of range')
        return v

class PracticalSetCreate(BaseModel):
    title: str
    description: str
    theme_ids: List[str]  # Can span multiple specific themes
    questions: List[PracticalSetQuestionCreate]
    
    @validator('questions')
    def validate_question_count(cls, v):
        if len(v) != 15:
            raise ValueError('Practical sets must have exactly 15 questions')
        return v
    
    @validator('questions')
    def validate_positions(cls, v):
        positions = [q.position for q in v]
        if sorted(positions) != list(range(1, 16)):
            raise ValueError('Questions must have positions 1-15 without gaps')
        return v

class PracticalSetQuestionInDB(PracticalSetQuestionCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

class PracticalSetInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    theme_ids: List[str]
    questions: List[PracticalSetQuestionInDB]
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class PracticalSetResponse(BaseModel):
    id: str
    title: str
    description: str
    theme_ids: List[str]
    question_count: int
    created_by: str
    created_at: datetime

class PracticalSetDetailResponse(BaseModel):
    id: str
    title: str
    description: str
    theme_ids: List[str]
    questions: List[PracticalSetQuestionInDB]
    created_by: str
    created_at: datetime
