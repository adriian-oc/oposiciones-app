from pydantic import BaseModel, Field, validator
from typing import Dict, Optional
from datetime import datetime
import uuid

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


class StudyPreferencesUpdate(BaseModel):
    """Horas que el alumno puede dedicar cada día de la semana."""
    hours_per_day: Dict[str, float]

    @validator('hours_per_day')
    def validate_days(cls, v):
        unknown = set(v.keys()) - set(WEEKDAYS)
        if unknown:
            raise ValueError(f"Días desconocidos: {unknown}. Debe ser: {WEEKDAYS}")
        for day, hours in v.items():
            if hours < 0 or hours > 12:
                raise ValueError(f"Horas fuera de rango (0-12) para {day}: {hours}")
        return v


class StudyPreferencesInDB(BaseModel):
    user_id: str
    hours_per_day: Dict[str, float] = Field(default_factory=dict)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class StudyCalendarEntryInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    date: str  # ISO date "2026-07-20"
    content_unit_key: Optional[str] = None  # id de practical_set, si es practicable directamente
    theme_id: Optional[str] = None
    title: str
    allocated_minutes: int
    priority_reason: str
    status: str = "pending"  # pending | done
    created_at: datetime = Field(default_factory=datetime.utcnow)


class StudyCalendarEntryResponse(BaseModel):
    id: str
    date: str
    content_unit_key: Optional[str] = None
    theme_id: Optional[str] = None
    title: str
    allocated_minutes: int
    priority_reason: str
    status: str
