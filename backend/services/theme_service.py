from repositories.theme_repository import ThemeRepository
from models.theme import ThemeCreate, ThemeResponse
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

class ThemeService:
    def __init__(self):
        self.theme_repo = ThemeRepository()
    
    async def create_theme(self, theme_data: ThemeCreate) -> dict:
        theme = await self.theme_repo.create(theme_data)
        return theme.model_dump()

    async def get_all_themes(self, part: Optional[str] = None) -> List[dict]:
        return await self.theme_repo.get_all(part)

    async def get_theme_by_id(self, theme_id: str) -> dict:
        theme = await self.theme_repo.get_by_id(theme_id)
        if not theme:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Theme not found"
            )
        return theme
    
    # Temas reales de ADOC (portados de ESPECIFICA_TEMAS/ESPECIFICA_TEMA_LABELS/GENERAL_TEMAS en
    # /Users/adrian/Desktop/Adoc/webapp/index.html:1131-1139). tema_key es la clave usada por
    # QUIZ_DATA (p.ej. "cuad_8IT") -- necesaria para que la migración del banco de preguntas
    # (scripts/migrate_quiz_data.py) pueda resolver theme_id a partir del prefijo+tema_key.
    SPECIFIC_THEMES = [
        ("1", "Tema 1 — Constitución y LGSS"),
        ("2", "Tema 2 — Acción Protectora RSE"),
        ("3", "Tema 3 — Afiliación, Altas y Bajas"),
        ("4", "Tema 4 — Cotización"),
        ("5", "Tema 5 — Recaudación"),
        ("6", "Tema 6 — Recaudación Ejecutiva"),
        ("7", "Tema 7 — Acción Protectora"),
        ("8IT", "Tema 8 — Incap. Temporal"),
        ("8IP", "Tema 8 — Incap. Permanente"),
        ("9", "Tema 9 — Nacimiento y Cuidado"),
        ("10", "Tema 10 — Jubilación"),
        ("11", "Tema 11 — Muerte y Supervivencia"),
        ("12", "Tema 12 — IMV / PNC / Prest. Fam."),
        ("13", "Tema 13 — Recursos Generales del Sistema"),
        ("prest", "Prestaciones RGSS"),
    ]
    GENERAL_THEMES = [(str(i), f"Tema {i}") for i in range(1, 24)]

    async def seed_initial_themes(self):
        """Siembra los temas reales de ADOC (15 específica + 23 general)."""
        existing = await self.theme_repo.get_all()
        if existing:
            logger.info("Themes already exist, skipping seed")
            return

        themes = []
        for order, (tema_key, name) in enumerate(self.SPECIFIC_THEMES, start=1):
            themes.append(ThemeCreate(code=f"SPECIFIC_{tema_key}", name=name, part="SPECIFIC", order=order))
        for order, (tema_key, name) in enumerate(self.GENERAL_THEMES, start=1):
            themes.append(ThemeCreate(code=f"GENERAL_{tema_key}", name=name, part="GENERAL", order=order))

        await self.theme_repo.bulk_create(themes)
        logger.info(f"Seeded {len(themes)} themes successfully")