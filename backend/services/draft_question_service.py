import re
from typing import List, Optional

from fastapi import HTTPException, status

from models.draft_question import DraftQuestionCreate, DraftQuestionUpdate
from models.practical_set import PracticalSetCreate, PracticalSetQuestionCreate
from repositories.draft_question_repository import DraftQuestionRepository
from repositories.practical_set_repository import PracticalSetRepository
from repositories.theme_repository import ThemeRepository
from services.practical_set_service import PracticalSetService

SUPUESTO_RE = re.compile(r"^Supuesto\s+(\d+)")
CUADERNILLO_PREFIX = "Cuadernillo"


class DraftQuestionService:
    """Banco de preguntas generadas pero sin publicar (p.ej. tras una novedad de temario) --
    admin y profesor las revisan/editan aquí y eligen lanzarlas como cuadernillo (se añaden al
    cuadernillo YA existente del tema, ver nota en _find_cuadernillo) o como supuesto nuevo
    (siempre standalone, numerado, nunca se fusiona con uno existente)."""

    def __init__(self):
        self.repo = DraftQuestionRepository()
        self.practical_set_repo = PracticalSetRepository()
        self.practical_set_service = PracticalSetService()
        self.theme_repo = ThemeRepository()

    async def list_drafts(self, theme_id: Optional[str] = None) -> List[dict]:
        return await self.repo.list_drafts(theme_id=theme_id)

    async def create_draft(self, data: DraftQuestionCreate, user_id: Optional[str]) -> dict:
        theme = await self.theme_repo.get_by_id(data.theme_id)
        if not theme:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Tema no encontrado")
        draft = await self.repo.create(data, user_id)
        return draft.model_dump()

    async def update_draft(self, draft_id: str, data: DraftQuestionUpdate) -> dict:
        existing = await self.repo.get_by_id(draft_id)
        if not existing:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Pregunta borrador no encontrada")
        fields = {k: v for k, v in data.model_dump().items() if v is not None}
        if "choices" in fields and len(fields["choices"]) < 2:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Se requieren al menos 2 opciones")
        choices = fields.get("choices", existing["choices"])
        correct_answer = fields.get("correct_answer", existing["correct_answer"])
        if correct_answer >= len(choices):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "correct_answer fuera de rango")
        updated = await self.repo.update(draft_id, fields)
        return updated

    async def delete_draft(self, draft_id: str) -> None:
        deleted = await self.repo.delete(draft_id)
        if not deleted:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Pregunta borrador no encontrada")

    async def _find_cuadernillo(self, theme_id: str) -> Optional[dict]:
        """Cuadernos.js solo pinta UN cuadernillo por tema (el que tenga ese theme_id en
        theme_ids) -- crear uno nuevo con el mismo tema dejaría el segundo invisible en el
        desplegable, así que "publicar como cuadernillo" siempre AÑADE preguntas al cuadernillo
        ya existente del tema en vez de crear un documento nuevo. Si el tema todavía no tiene
        ninguno, sí se crea el primero."""
        candidates = await self.practical_set_repo.get_by_theme(theme_id)
        cuadernillos = [ps for ps in candidates if ps["title"].startswith(CUADERNILLO_PREFIX)]
        return cuadernillos[0] if cuadernillos else None

    async def _next_supuesto_title(self) -> str:
        all_sets = await self.practical_set_repo.get_all(0, 1000)
        max_n = 0
        for ps in all_sets:
            m = SUPUESTO_RE.match(ps["title"])
            if m:
                max_n = max(max_n, int(m.group(1)))
        return f"Supuesto {max_n + 1}"

    async def publish(
        self,
        question_ids: List[str],
        theme_id: str,
        target: str,
        title: Optional[str],
        description: Optional[str],
        user_id: str,
    ) -> dict:
        if target not in ("cuadernillo", "supuesto"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "target debe ser 'cuadernillo' o 'supuesto'")

        theme = await self.theme_repo.get_by_id(theme_id)
        if not theme:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Tema no encontrado")

        drafts = await self.repo.get_many_by_ids(question_ids)
        if len(drafts) != len(question_ids):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Alguna pregunta borrador no existe")
        for d in drafts:
            if d["theme_id"] != theme_id:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Todas las preguntas deben ser del mismo tema")
            if d["status"] != "draft":
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"La pregunta {d['id']} ya se publicó")
        if not drafts:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Selecciona al menos una pregunta")

        if target == "cuadernillo":
            existing = await self._find_cuadernillo(theme_id)
            if existing:
                for d in drafts:
                    await self.practical_set_service.add_question(
                        existing["id"],
                        {"text": d["text"], "choices": d["choices"], "correct_answer": d["correct_answer"]},
                    )
                practical_set_id = existing["id"]
                created_new = False
            else:
                new_title = title or f"{CUADERNILLO_PREFIX} — {theme['name']}"
                ps = await self.practical_set_repo.create(
                    PracticalSetCreate(
                        title=new_title,
                        description=description or "",
                        theme_ids=[theme_id],
                        questions=[
                            PracticalSetQuestionCreate(
                                position=i + 1, text=d["text"], choices=d["choices"], correct_answer=d["correct_answer"]
                            )
                            for i, d in enumerate(drafts)
                        ],
                    ),
                    user_id,
                )
                practical_set_id = ps.id
                created_new = True
        else:  # supuesto: siempre nuevo, nunca se fusiona con uno existente
            new_title = title or await self._next_supuesto_title()
            ps = await self.practical_set_repo.create(
                PracticalSetCreate(
                    title=new_title,
                    description=description or "",
                    theme_ids=[],
                    questions=[
                        PracticalSetQuestionCreate(
                            position=i + 1, text=d["text"], choices=d["choices"], correct_answer=d["correct_answer"]
                        )
                        for i, d in enumerate(drafts)
                    ],
                ),
                user_id,
            )
            practical_set_id = ps.id
            created_new = True

        await self.repo.mark_published(question_ids)
        return {
            "practical_set_id": practical_set_id,
            "target": target,
            "question_count": len(drafts),
            "created_new": created_new,
        }
