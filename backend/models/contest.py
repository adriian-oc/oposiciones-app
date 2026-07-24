from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
import uuid


class ContestConfig(BaseModel):
    """Config del Concurso de Acceso -- documento único (`contest_config`), autoinicializado la
    primera vez que se pide (ver ContestService.get_config). Los 3 supuestos se eligen al azar
    UNA sola vez al crear la config y quedan fijos: para que la clasificación sea comparable
    entre participantes, todos deben enfrentarse al mismo contenido."""
    id: str = "contest_config"
    active: bool = True
    max_participants: int = 300
    start_at: datetime = Field(default_factory=datetime.utcnow)
    end_at: datetime
    theme_id: str  # Tema 3 (parte específica) -- lectura + Test de Teoría + Cuadernillo
    theme_name: str = ""
    practical_set_ids: List[str] = Field(default_factory=list)  # 3 Supuestos fijos
    practical_set_titles: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    def allowed_content_keys(self) -> List[str]:
        keys = [f"ttesp:{self.theme_id}", f"cuad:{self.theme_id}"]
        keys += [f"gen:{pid}" for pid in self.practical_set_ids]
        return keys


class ContestSignupCreate(BaseModel):
    nombre: str
    email: EmailStr

    class Config:
        str_strip_whitespace = True


class ContestEntryInDB(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    email: str
    display_name: str
    joined_at: datetime = Field(default_factory=datetime.utcnow)


class ContestEntryResponse(BaseModel):
    id: str
    user_id: str
    email: str
    display_name: str
    joined_at: datetime


class ContestRankingEntry(BaseModel):
    rank: int
    display_name: str
    email: Optional[str] = None  # solo se rellena para admin; el ranking de alumno va anonimizado
    best_score: Optional[float] = None
    scale: Optional[float] = None
    is_me: bool = False
