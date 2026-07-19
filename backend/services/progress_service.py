from datetime import datetime, date, timedelta
import logging

from repositories.progress_repository import ProgressRepository

logger = logging.getLogger(__name__)


def _sm2_update(prev: dict, pct: float) -> dict:
    """Actualiza el estado de repetición espaciada de una unidad de contenido con la regla
    estándar de SM-2 (Wozniak 1987, la base del scheduler de Anki durante años): cada acierto
    alarga el intervalo hasta la próxima revisión (1 día -> 6 días -> intervalo_anterior *
    ease_factor), cada fallo lo reinicia a 1 día. `quality` (0-5) traduce el % de acierto de la
    práctica recién terminada -- aquí una "revisión" cubre varias preguntas de la unidad, no una
    sola tarjeta como en un mazo de flashcards, así que se aproxima por el % de aciertos en vez
    de un simple acierto/fallo."""
    if pct >= 100:
        quality = 5
    elif pct >= 75:
        quality = 4
    elif pct >= 60:
        quality = 3
    elif pct >= 40:
        quality = 2
    elif pct >= 20:
        quality = 1
    else:
        quality = 0

    ease_factor = prev.get("ease_factor", 2.5)
    repetitions = prev.get("repetitions", 0)
    interval_days = prev.get("interval_days", 0)

    if quality < 3:
        repetitions = 0
        interval_days = 1
    else:
        if repetitions == 0:
            interval_days = 1
        elif repetitions == 1:
            interval_days = 6
        else:
            interval_days = round(interval_days * ease_factor)
        repetitions += 1

    ease_factor = max(1.3, ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

    return {
        "ease_factor": round(ease_factor, 2),
        "repetitions": repetitions,
        "interval_days": interval_days,
        "next_review_date": (date.today() + timedelta(days=interval_days)).isoformat(),
    }


class ProgressService:
    def __init__(self):
        self.progress_repo = ProgressRepository()

    async def get_progress(self, user_id: str) -> dict:
        existing = await self.progress_repo.get_by_user(user_id)
        return existing or {
            "user_id": user_id,
            "content_scores": {},
            "streak": {"count": 0, "last_active_date": None},
            "updated_at": None,
        }

    async def get_summary(self, user_id: str) -> dict:
        """Stat cards de la página de progreso: acumula TODOS los intentos de práctica
        terminados (no solo el último por unidad, a diferencia de content_scores), para que
        las cifras reflejen el histórico completo del alumno. Import directo del repositorio
        (no del servicio) para evitar el ciclo que ExamService ya evita importando
        ProgressService de forma perezosa."""
        from repositories.exam_repository import ExamRepository
        attempts = await ExamRepository().get_finished_practice_attempts(user_id)
        correct = 0
        total = 0
        for attempt in attempts:
            details = attempt.get("details") or {}
            correct += details.get("correct", 0)
            total += details.get("total_questions", 0)
        wrong = total - correct
        pct = round((correct / total) * 100, 2) if total else 0.0
        return {"answered": total, "correct": correct, "wrong": wrong, "pct": pct}

    async def record_practice_result(self, user_id: str, content_unit_key: str, correct: int, total: int) -> None:
        """Rollup de lectura rápida para 'Mi Progreso', escrito como efecto secundario de
        finish_attempt (mismo patrón que analytics_service.record_attempt_results) -- no es una
        segunda fuente de verdad, `attempts` sigue siendo el detalle completo."""
        existing = await self.progress_repo.get_by_user(user_id) or {}
        content_scores = existing.get("content_scores", {})
        pct = round((correct / total) * 100, 2) if total else 0.0
        sm2_state = _sm2_update(content_scores.get(content_unit_key) or {}, pct)
        content_scores[content_unit_key] = {
            "correct": correct,
            "total": total,
            "pct": pct,
            "updated_at": datetime.utcnow(),
            **sm2_state,
        }

        streak = self._advance_streak(existing.get("streak", {}))

        await self.progress_repo.upsert(user_id, {
            "user_id": user_id,
            "content_scores": content_scores,
            "streak": streak,
            "updated_at": datetime.utcnow(),
        })

    @staticmethod
    def _advance_streak(streak: dict) -> dict:
        today = date.today()
        last_active_raw = streak.get("last_active_date")
        last_active = None
        if isinstance(last_active_raw, str):
            last_active = date.fromisoformat(last_active_raw)
        elif isinstance(last_active_raw, date):
            last_active = last_active_raw

        count = streak.get("count", 0)
        if last_active == today:
            pass  # ya contaba hoy, no se incrementa dos veces
        elif last_active == today - timedelta(days=1):
            count += 1
        else:
            count = 1

        return {"count": count, "last_active_date": today.isoformat()}
