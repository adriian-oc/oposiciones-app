from datetime import datetime, timedelta
from typing import Optional
import logging

from fastapi import HTTPException, status

from models.contest import ContestConfig, ContestSignupCreate, ContestEntryInDB
from models.user import UserCreate
from repositories.contest_repository import ContestRepository
from repositories.theme_repository import ThemeRepository
from repositories.practical_set_repository import PracticalSetRepository
from repositories.user_repository import UserRepository
from repositories.exam_repository import ExamRepository

logger = logging.getLogger(__name__)

CONTEST_THEME_CODE = "SPECIFIC_3"
CONTEST_DURATION_DAYS = 20
CONTEST_MAX_PARTICIPANTS = 300
CONTEST_PRACTICAL_SET_COUNT = 3


class ContestService:
    def __init__(self):
        self.repo = ContestRepository()
        self.theme_repo = ThemeRepository()
        self.practical_set_repo = PracticalSetRepository()
        self.user_repo = UserRepository()
        self.exam_repo = ExamRepository()
        # Import perezoso -- evita el ciclo con AdminService (importa EmailService/etc)
        from services.admin_service import AdminService
        self.admin_service = AdminService()

    async def get_config(self) -> dict:
        """Autoinicializa la config la primera vez que se pide: fija las fechas y elige los 3
        Supuestos al azar UNA sola vez -- después queda fija (se guarda en Mongo), para que
        todos los participantes compitan sobre el mismo contenido."""
        existing = await self.repo.get_config()
        if existing:
            return existing

        theme = await self.theme_repo.get_by_code(CONTEST_THEME_CODE)
        if not theme:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Tema del concurso no encontrado")

        # Solo Supuestos independientes (sin theme_ids): su clave de acceso es "gen:<id>" y
        # concede EXACTAMENTE ese Supuesto. Si tuviera theme_ids, la clave sería "cuad:<theme_id>"
        # y desbloquearía todos los cuadernillos de ese tema -- más de lo que el concurso da.
        candidates = await self.practical_set_repo.get_random(count=CONTEST_PRACTICAL_SET_COUNT * 3)
        standalone = [p for p in candidates if not p.get("theme_ids")][:CONTEST_PRACTICAL_SET_COUNT]

        now = datetime.utcnow()
        config = ContestConfig(
            end_at=now + timedelta(days=CONTEST_DURATION_DAYS),
            max_participants=CONTEST_MAX_PARTICIPANTS,
            theme_id=theme["id"],
            theme_name=theme["name"],
            practical_set_ids=[p["id"] for p in standalone],
            practical_set_titles=[p["title"] for p in standalone],
        )
        await self.repo.save_config(config)
        logger.info(f"Contest config initialized: ends {config.end_at}, sets {config.practical_set_titles}")
        return config.model_dump()

    async def _is_open(self, config: dict) -> None:
        if not config.get("active", True):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "El concurso no está activo")
        end_at = config["end_at"]
        if isinstance(end_at, str):
            end_at = datetime.fromisoformat(end_at)
        if end_at.tzinfo:
            end_at = end_at.replace(tzinfo=None)
        if datetime.utcnow() > end_at:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "El plazo de inscripción del concurso ha terminado")
        count = await self.repo.count_entries()
        if count >= config.get("max_participants", CONTEST_MAX_PARTICIPANTS):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Se han agotado las plazas del concurso")

    async def signup(self, data: ContestSignupCreate) -> dict:
        config = await self.get_config()
        await self._is_open(config)

        email = data.email.lower()
        if await self.repo.get_entry_by_email(email):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Este email ya está inscrito en el concurso")
        if await self.user_repo.email_exists(email):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Ya existe una cuenta con ese email -- contacta con administración para unirte al concurso",
            )

        user = await self.admin_service.create_student(UserCreate(
            email=email,
            display_name=data.nombre,
            role="student",
            allowed_content=ContestConfig(**config).allowed_content_keys(),
        ))

        entry = ContestEntryInDB(user_id=user.id, email=email, display_name=data.nombre)
        await self.repo.create_entry(entry)
        logger.info(f"Contest signup: {email}")
        return entry.model_dump()

    async def get_my_entry(self, user_id: str) -> Optional[dict]:
        return await self.repo.get_entry_by_user_id(user_id)

    async def _compute_scores(self, config: dict) -> list[dict]:
        """Mejor nota de cada participante entre los intentos terminados sobre contenido del
        concurso (mismas content_unit_key que allowed_content, así no cuenta nada fuera del
        temario/Supuestos asignados)."""
        content_keys = set(ContestConfig(**config).allowed_content_keys())
        entries = await self.repo.get_all_entries()
        results = []
        for entry in entries:
            attempts = await self.exam_repo.get_finished_practice_attempts(entry["user_id"])
            # get_finished_practice_attempts ya filtra mode=practice; los intentos de
            # start_theory_practice también usan mode=practice, así que cubre Tema 3 y Supuestos.
            best = None
            best_scale = None
            for attempt in attempts:
                if attempt.get("content_unit_key") not in content_keys:
                    continue
                details = attempt.get("details") or {}
                score = details.get("final_score")
                if score is None:
                    continue
                if best is None or score > best:
                    best = score
                    best_scale = details.get("scale")
            results.append({**entry, "best_score": best, "scale": best_scale})
        return results

    async def get_ranking(self, viewer_user_id: Optional[str] = None, reveal_emails: bool = False) -> list[dict]:
        config = await self.get_config()
        scored = await self._compute_scores(config)
        scored.sort(key=lambda e: (e["best_score"] is None, -(e["best_score"] or 0)))
        ranking = []
        for idx, entry in enumerate(scored, start=1):
            ranking.append({
                "rank": idx,
                "display_name": entry["display_name"],
                "email": entry["email"] if reveal_emails else None,
                "best_score": entry["best_score"],
                "scale": entry["scale"],
                "is_me": entry["user_id"] == viewer_user_id,
            })
        return ranking

    async def get_admin_summary(self) -> dict:
        config = await self.get_config()
        ranking = await self.get_ranking(reveal_emails=True)
        return {
            "config": config,
            "participants_count": len(ranking),
            "ranking": ranking,
        }
